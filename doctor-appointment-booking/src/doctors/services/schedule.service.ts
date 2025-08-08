import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { DoctorAvailability } from '../entities/doctor-availability.entity';
import { DoctorTimeSlot } from '../entities/doctor-time-slot.entity';
import { UnifiedRescheduleDto, SchedulingType } from '../dto/schedule-operations.dto';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { AppointmentStatus } from '../../appointments/enums/appointment-status.enum';
import { TimeSlotStatus } from '../enums/availability.enums';
import { TimeUtils } from '../../common/utils/time.utils';

// Service for all doctor schedule operations
// Handles: slot-to-slot movement, time shifting, and schedule shrinking
@Injectable()
export class ScheduleService {
     constructor(
          @InjectRepository(DoctorAvailability)
          private availabilityRepository: Repository<DoctorAvailability>,
          @InjectRepository(DoctorTimeSlot)
          private timeslotRepository: Repository<DoctorTimeSlot>,
          @InjectRepository(Appointment)
          private appointmentRepository: Repository<Appointment>,
     ) { }

     // Move appointments from one time slot to another
     // Used for slot-to-slot rescheduling operations
     async moveSlots(doctorId: number, dto: {
          availability_id: number;
          source_slot_id: number;
          target_slot_id: number;
          appointment_id?: number;
          reason?: string;
     }) {
          // Validate both slots belong to doctor
          const sourceSlot = await this.validateSlotOwnership(dto.source_slot_id, doctorId);
          const targetSlot = await this.validateSlotOwnership(dto.target_slot_id, doctorId);

          // Get appointments to move
          const appointmentsToMove = await this.getAppointmentsFromSlot(
               dto.source_slot_id,
               dto.appointment_id
          );

          if (appointmentsToMove.length === 0) {
               throw new NotFoundException('No appointments found to move');
          }

          // Check target slot capacity
          const targetCapacity = await this.getSlotAvailableCapacity(dto.target_slot_id);
          if (targetCapacity < appointmentsToMove.length) {
               throw new ConflictException(
                    `Target slot has insufficient capacity. Available: ${targetCapacity}, Required: ${appointmentsToMove.length}`
               );
          }

          // Move appointments with proper status tracking
          const movedSlotIds = new Set<number>();
          for (const appointment of appointmentsToMove) {
               const oldSlotId = appointment.time_slot.timeslot_id;
               await this.moveAppointmentToSlot(appointment.appointment_id, dto.target_slot_id, dto.reason);
               movedSlotIds.add(oldSlotId);
               movedSlotIds.add(dto.target_slot_id);
          }

          // Batch update all affected slot statuses for consistency
          await this.batchUpdateSlotStatuses(Array.from(movedSlotIds));

          return {
               message: 'Appointments moved successfully',
               data: {
                    doctor_user_id: sourceSlot.availability.doctor.user_id,
                    moved_appointments: appointmentsToMove.length,
                    source_slot: `${sourceSlot.start_time}-${sourceSlot.end_time}`,
                    target_slot: `${targetSlot.start_time}-${targetSlot.end_time}`,
                    appointments: appointmentsToMove.map(app => ({
                         appointment_id: app.appointment_id,
                         patient_name: app.patient.user.profile.full_name
                    }))
               }
          };
     }

     // Shift all time slots by moving start and end times
     // Used for time shift operations
     async shiftTime(doctorId: number, dto: {
          availability_id: number;
          new_start_time: string;
          new_end_time: string;
          shift_minutes?: number;
          reason?: string;
     }) {
          // Validate availability belongs to doctor
          const availability = await this.validateAvailability(dto.availability_id, doctorId);

          // Use provided shift_minutes directly
          const shiftMinutes = dto.shift_minutes;

          if (!shiftMinutes || shiftMinutes === 0) {
               throw new BadRequestException('shift_minutes is required and must be non-zero');
          }

          // Get all slots for this availability
          const slots = await this.timeslotRepository.find({
               where: {
                    availability: { availability_id: dto.availability_id },
                    is_deleted: false
               },
               relations: ['appointments']
          });

          if (slots.length === 0) {
               throw new NotFoundException('No time slots found for this availability');
          }

          // Apply time shift to availability
          availability.consulting_start_time = dto.new_start_time;
          availability.consulting_end_time = dto.new_end_time;
          await this.availabilityRepository.save(availability);

          // Apply time shift to all slots
          const shiftedSlots: any[] = [];
          for (const slot of slots) {
               const newStartTime = TimeUtils.shiftTime(slot.start_time, shiftMinutes);
               const newEndTime = TimeUtils.shiftTime(slot.end_time, shiftMinutes);

               // Store original times for logging
               const originalStart = slot.start_time;
               const originalEnd = slot.end_time;

               // Update slot with new times
               slot.start_time = newStartTime;
               slot.end_time = newEndTime;
               await this.timeslotRepository.save(slot);

               shiftedSlots.push({
                    slot_id: slot.timeslot_id,
                    old_time: `${originalStart}-${originalEnd}`,
                    new_time: `${newStartTime}-${newEndTime}`,
                    appointments_count: slot.appointments?.length || 0
               });
          }

          return {
               message: 'Schedule time shifted successfully',
               data: {
                    doctor_user_id: availability.doctor.user_id,
                    shift_minutes: shiftMinutes,
                    old_schedule: `${availability.consulting_start_time}-${availability.consulting_end_time}`,
                    new_schedule: `${dto.new_start_time}-${dto.new_end_time}`,
                    slots_updated: shiftedSlots.length,
                    slot_details: shiftedSlots
               }
          };
     }

     // Reduce schedule time by removing slots from start or end
     // Automatically reschedules affected appointments using FCFS logic
     async shrinkSchedule(doctorId: number, dto: {
          availability_id: number;
          new_start_time?: string;
          new_end_time?: string;
          reason?: string;
     }) {
          // Validate doctor owns this availability
          const availability = await this.validateAvailability(dto.availability_id, doctorId);

          // Validate parameters
          this.validateShrinkingParameters(dto, availability);

          // Get affected appointments based on what's being shrunk
          const affectedAppointments = await this.getAffectedAppointments(availability, dto);

          if (affectedAppointments.length === 0) {
               // No appointments affected - safe to shrink
               await this.applyShrinking(availability, dto);
               return {
                    message: 'Schedule shrunk successfully - no appointments affected',
                    data: {
                         doctor_user_id: availability.doctor.user_id,
                         new_start_time: dto.new_start_time || availability.consulting_start_time,
                         new_end_time: dto.new_end_time || availability.consulting_end_time,
                         appointments_rescheduled: 0
                    }
               };
          }

          // Generate FCFS rescheduling strategy
          const strategy = await this.generateRescheduleStrategy(doctorId, availability, dto, affectedAppointments);

          // Check if rescheduling is possible
          if (!strategy.success) {
               const availableCapacity = 'available_capacity' in strategy ? strategy.available_capacity : 0;
               throw new ConflictException({
                    message: 'Cannot shrink schedule - insufficient capacity for rescheduling',
                    error_code: 'INSUFFICIENT_CAPACITY',
                    affected_appointments: affectedAppointments.length,
                    available_capacity: availableCapacity,
                    recommendation: 'Please create more future slots or choose different shrinking parameters'
               });
          }

          // Execute rescheduling for all affected appointments
          for (const action of strategy.reschedule_actions) {
               await this.rescheduleAppointment(action.appointment_id, action.new_timeslot_id, action.reason);
          }

          // Apply the schedule shrinking
          await this.applyShrinking(availability, dto);

          return {
               message: `Schedule shrunk successfully with FCFS rescheduling`,
               data: {
                    doctor_user_id: availability.doctor.user_id,
                    new_start_time: dto.new_start_time || availability.consulting_start_time,
                    new_end_time: dto.new_end_time || availability.consulting_end_time,
                    appointments_rescheduled: strategy.reschedule_actions.length,
                    reschedule_details: strategy.reschedule_actions
               }
          };
     }

     // Main entry point for all rescheduling operations
     // Routes to appropriate method based on operation type
     async unifiedReschedule(doctorId: number, dto: UnifiedRescheduleDto) {
          // Validate required fields based on scheduling type
          this.validateUnifiedRescheduleDto(dto);

          switch (dto.scheduling_type) {
               case SchedulingType.SLOT_SLOT:
                    // Direct call to moveSlots with inline data
                    return await this.moveSlots(doctorId, {
                         availability_id: dto.availability_id,
                         source_slot_id: dto.source_slot_id!,
                         target_slot_id: dto.target_slot_id!,
                         appointment_id: dto.appointment_id,
                         reason: dto.reason
                    });

               case SchedulingType.TIME_SHIFT:
                    // Direct call to shiftTime with inline data
                    return await this.shiftTime(doctorId, {
                         availability_id: dto.availability_id,
                         new_start_time: dto.new_start_time!,
                         new_end_time: dto.new_end_time!,
                         shift_minutes: dto.shift_minutes,
                         reason: dto.reason
                    });

               case SchedulingType.SHRINKING:
                    // Direct call to shrinkSchedule with inline data
                    return await this.shrinkSchedule(doctorId, {
                         availability_id: dto.availability_id,
                         new_start_time: dto.new_start_time,
                         new_end_time: dto.new_end_time,
                         reason: dto.reason
                    });

               default:
                    throw new BadRequestException('Invalid scheduling type');
          }
     }

     // Validate DTO fields based on operation type
     private validateUnifiedRescheduleDto(dto: UnifiedRescheduleDto) {
          switch (dto.scheduling_type) {
               case SchedulingType.SLOT_SLOT:
                    if (!dto.source_slot_id || !dto.target_slot_id) {
                         throw new BadRequestException('source_slot_id and target_slot_id are required for SLOT_SLOT operations');
                    }
                    break;

               case SchedulingType.TIME_SHIFT:
                    if (!dto.new_start_time || !dto.new_end_time) {
                         throw new BadRequestException('new_start_time and new_end_time are required for TIME_SHIFT operations');
                    }
                    break;

               case SchedulingType.SHRINKING:
                    if (!dto.new_start_time && !dto.new_end_time) {
                         throw new BadRequestException('At least one of new_start_time or new_end_time is required for SHRINKING operations');
                    }
                    break;

               default:
                    throw new BadRequestException('Invalid scheduling type');
          }
     }

     // Check if availability belongs to doctor
     private async validateAvailability(availabilityId: number, doctorId: number): Promise<DoctorAvailability> {
          const availability = await this.availabilityRepository.findOne({
               where: {
                    availability_id: availabilityId,
                    doctor: { user_id: doctorId }
               },
               relations: ['doctor']
          });

          if (!availability) {
               throw new NotFoundException('Availability not found or does not belong to this doctor');
          }

          return availability;
     }

     // Validate shrinking operation parameters
     private validateShrinkingParameters(dto: {
          availability_id: number;
          new_start_time?: string;
          new_end_time?: string;
          reason?: string;
     }, availability: DoctorAvailability) {
          // Check that at least one parameter is provided
          if (!dto.new_start_time && !dto.new_end_time) {
               throw new BadRequestException('At least one of new_start_time or new_end_time must be provided');
          }

          // Validate new_end_time if provided
          if (dto.new_end_time) {
               if (dto.new_end_time >= availability.consulting_end_time) {
                    throw new BadRequestException('New end time must be earlier than current end time');
               }
          }

          // Validate new_start_time if provided
          if (dto.new_start_time) {
               if (dto.new_start_time <= availability.consulting_start_time) {
                    throw new BadRequestException('New start time must be later than current start time');
               }
          }

          // If both are provided, ensure new_start_time is before new_end_time
          if (dto.new_start_time && dto.new_end_time) {
               if (dto.new_start_time >= dto.new_end_time) {
                    throw new BadRequestException('New start time must be earlier than new end time');
               }
          }
     }

     // Find appointments that will be affected by schedule shrinking
     // Returns appointments sorted by FCFS (first scheduled first)
     private async getAffectedAppointments(availability: DoctorAvailability, dto: {
          availability_id: number;
          new_start_time?: string;
          new_end_time?: string;
          reason?: string;
     }) {
          const affectedAppointments: any[] = [];

          // If shrinking from end (new_end_time provided)
          if (dto.new_end_time) {
               const endAffected = await this.appointmentRepository.find({
                    where: {
                         appointment_status: AppointmentStatus.SCHEDULED,
                         time_slot: {
                              availability: { availability_id: availability.availability_id },
                              start_time: MoreThan(dto.new_end_time)
                         }
                    },
                    relations: ['patient', 'patient.user', 'time_slot'],
                    order: {
                         time_slot: { start_time: 'ASC' },
                         scheduled_on: 'ASC'
                    }
               });
               affectedAppointments.push(...endAffected);
          }

          // If shrinking from start (new_start_time provided)
          if (dto.new_start_time) {
               const startAffected = await this.appointmentRepository.find({
                    where: {
                         appointment_status: AppointmentStatus.SCHEDULED,
                         time_slot: {
                              availability: { availability_id: availability.availability_id },
                              end_time: LessThan(dto.new_start_time)
                         }
                    },
                    relations: ['patient', 'patient.user', 'time_slot'],
                    order: {
                         time_slot: { start_time: 'ASC' },
                         scheduled_on: 'ASC'
                    }
               });
               affectedAppointments.push(...startAffected);
          }

          // Remove duplicates and sort by FCFS (scheduled_on time)
          const uniqueAppointments = affectedAppointments.filter((appointment, index, arr) =>
               arr.findIndex(a => a.appointment_id === appointment.appointment_id) === index
          );

          return uniqueAppointments.sort((a, b) => {
               return new Date(a.scheduled_on).getTime() - new Date(b.scheduled_on).getTime();
          });
     }

     // Create strategy for rescheduling affected appointments
     // Uses FCFS principle to find available slots
     private async generateRescheduleStrategy(doctorId: number, availability: DoctorAvailability, dto: {
          availability_id: number;
          new_start_time?: string;
          new_end_time?: string;
          reason?: string;
     }, affectedAppointments: any[]) {
          // Step 1: Try same day slots that will remain available after shrinking
          const sameDaySlots = await this.findSameDayAvailableSlots(availability, dto);
          const sameDayCapacity = sameDaySlots.reduce((sum, slot) => sum + slot.available_spots, 0);

          if (sameDayCapacity >= affectedAppointments.length) {
               return this.createRescheduleActions(affectedAppointments, sameDaySlots);
          }

          // Step 2: Try next available day
          const currentDate = this.getDateString(availability.date);
          const nextDayData = await this.findNextAvailableDay(doctorId, currentDate);

          if (nextDayData && nextDayData.capacity >= affectedAppointments.length) {
               return this.createRescheduleActions(affectedAppointments, nextDayData.slots, nextDayData.date);
          }

          // Step 3: Try multiple future days
          const multiDayData = await this.findMultipleFutureDays(doctorId, currentDate, affectedAppointments.length);

          if (multiDayData.sufficient) {
               return this.createMultiDayRescheduleActions(affectedAppointments, multiDayData.days);
          }

          // Not enough capacity
          return {
               success: false,
               available_capacity: multiDayData.total_capacity,
               reschedule_actions: []
          };
     }

     // Find available slots on same day after shrinking
     private async findSameDayAvailableSlots(availability: DoctorAvailability, dto: {
          availability_id: number;
          new_start_time?: string;
          new_end_time?: string;
          reason?: string;
     }) {
          let timeConditions: string[] = [];

          // Build time conditions based on what's being shrunk
          if (dto.new_end_time) {
               // Keep slots that end before or at new end time
               timeConditions.push(`slot.end_time <= '${dto.new_end_time}'`);
          }

          if (dto.new_start_time) {
               // Keep slots that start at or after new start time
               timeConditions.push(`slot.start_time >= '${dto.new_start_time}'`);
          }

          // If both conditions exist, use AND to get slots in the remaining time range
          const timeCondition = timeConditions.length > 1
               ? timeConditions.join(' AND ')
               : timeConditions[0];

          const availableSlots = await this.timeslotRepository
               .createQueryBuilder('slot')
               .leftJoin('slot.appointments', 'appointment', 'appointment.appointment_status = :status', { status: AppointmentStatus.SCHEDULED })
               .where('slot.availability_id = :availabilityId', { availabilityId: availability.availability_id })
               .andWhere(timeCondition)
               .andWhere('slot.is_deleted = false')
               .andWhere('slot.status = :slotStatus', { slotStatus: TimeSlotStatus.AVAILABLE })
               .groupBy('slot.timeslot_id, slot.start_time, slot.end_time, slot.max_patients')
               .having('COUNT(appointment.appointment_id) < slot.max_patients')
               .orderBy('slot.start_time', 'ASC')
               .select([
                    'slot.timeslot_id',
                    'slot.start_time',
                    'slot.end_time',
                    'slot.max_patients',
                    'COUNT(appointment.appointment_id) as current_appointments'
               ])
               .getRawMany();

          return availableSlots.map(slot => ({
               timeslot_id: slot.slot_timeslot_id,
               start_time: slot.slot_start_time,
               end_time: slot.slot_end_time,
               max_patients: slot.slot_max_patients,
               current_appointments: parseInt(slot.current_appointments),
               available_spots: slot.slot_max_patients - parseInt(slot.current_appointments)
          }));
     }

     /**
      * Find next available day with capacity
      */
     private async findNextAvailableDay(doctorId: number, currentDate: string) {
          const nextAvailability = await this.availabilityRepository
               .createQueryBuilder('availability')
               .innerJoin('availability.doctor', 'doctor')
               .where('doctor.user_id = :doctorId', { doctorId })
               .andWhere('availability.date > :currentDate', { currentDate })
               .orderBy('availability.date', 'ASC')
               .getOne();

          if (!nextAvailability) {
               return null;
          }

          const slots = await this.findAllAvailableSlotsOnDay(nextAvailability.availability_id);
          const capacity = slots.reduce((sum, slot) => sum + slot.available_spots, 0);

          return {
               date: this.getDateString(nextAvailability.date),
               slots,
               capacity
          };
     }

     /**
      * Find all available slots on a specific day
      */
     private async findAllAvailableSlotsOnDay(availabilityId: number) {
          const availableSlots = await this.timeslotRepository
               .createQueryBuilder('slot')
               .leftJoin('slot.appointments', 'appointment', 'appointment.appointment_status = :status', { status: AppointmentStatus.SCHEDULED })
               .where('slot.availability_id = :availabilityId', { availabilityId })
               .andWhere('slot.is_deleted = false')
               .andWhere('slot.status = :slotStatus', { slotStatus: TimeSlotStatus.AVAILABLE })
               .groupBy('slot.timeslot_id, slot.start_time, slot.end_time, slot.max_patients')
               .having('COUNT(appointment.appointment_id) < slot.max_patients')
               .orderBy('slot.start_time', 'ASC')
               .select([
                    'slot.timeslot_id',
                    'slot.start_time',
                    'slot.end_time',
                    'slot.max_patients',
                    'COUNT(appointment.appointment_id) as current_appointments'
               ])
               .getRawMany();

          return availableSlots.map(slot => ({
               timeslot_id: slot.slot_timeslot_id,
               start_time: slot.slot_start_time,
               end_time: slot.slot_end_time,
               max_patients: slot.slot_max_patients,
               current_appointments: parseInt(slot.current_appointments),
               available_spots: slot.slot_max_patients - parseInt(slot.current_appointments)
          }));
     }

     /**
      * Find multiple future days to distribute appointments
      */
     private async findMultipleFutureDays(doctorId: number, currentDate: string, requiredCapacity: number) {
          const futureDays = await this.availabilityRepository
               .createQueryBuilder('availability')
               .innerJoin('availability.doctor', 'doctor')
               .where('doctor.user_id = :doctorId', { doctorId })
               .andWhere('availability.date > :currentDate', { currentDate })
               .orderBy('availability.date', 'ASC')
               .limit(7) // Look at next 7 days max
               .getMany();

          const daysWithCapacity: any[] = [];
          let totalCapacityFound = 0;

          for (const day of futureDays) {
               const daySlots = await this.findAllAvailableSlotsOnDay(day.availability_id);
               const dayCapacity = daySlots.reduce((sum, slot) => sum + slot.available_spots, 0);

               if (dayCapacity > 0) {
                    daysWithCapacity.push({
                         date: this.getDateString(day.date),
                         slots: daySlots,
                         capacity: dayCapacity
                    });

                    totalCapacityFound += dayCapacity;

                    if (totalCapacityFound >= requiredCapacity) {
                         break;
                    }
               }
          }

          return {
               days: daysWithCapacity,
               total_capacity: totalCapacityFound,
               sufficient: totalCapacityFound >= requiredCapacity
          };
     }

     /**
      * Create reschedule actions for appointments
      */
     private createRescheduleActions(appointments: any[], slots: any[], date?: string) {
          const actions: any[] = [];
          let slotIndex = 0;

          for (const appointment of appointments) {
               // Find next available slot with capacity
               while (slotIndex < slots.length && slots[slotIndex].available_spots === 0) {
                    slotIndex++;
               }

               if (slotIndex < slots.length) {
                    const timeRange = `${slots[slotIndex].start_time}-${slots[slotIndex].end_time}`;
                    const reason = date
                         ? `Rescheduled to ${timeRange} on ${date}`
                         : `Rescheduled to ${timeRange}`;

                    actions.push({
                         appointment_id: appointment.appointment_id,
                         patient_name: appointment.patient.user.full_name,
                         current_time: `${appointment.time_slot.start_time}-${appointment.time_slot.end_time}`,
                         new_timeslot_id: slots[slotIndex].timeslot_id,
                         new_time: timeRange,
                         new_date: date || null,
                         reason
                    });

                    slots[slotIndex].available_spots--;
               }
          }

          return {
               success: actions.length === appointments.length,
               reschedule_actions: actions
          };
     }

     /**
      * Create multi-day reschedule actions
      */
     private createMultiDayRescheduleActions(appointments: any[], days: any[]) {
          const actions: any[] = [];
          let appointmentIndex = 0;

          for (const dayData of days) {
               let slotIndex = 0;

               while (appointmentIndex < appointments.length && slotIndex < dayData.slots.length) {
                    if (dayData.slots[slotIndex].available_spots > 0) {
                         const slot = dayData.slots[slotIndex];
                         const appointment = appointments[appointmentIndex];

                         actions.push({
                              appointment_id: appointment.appointment_id,
                              patient_name: appointment.patient.user.full_name,
                              current_time: `${appointment.time_slot.start_time}-${appointment.time_slot.end_time}`,
                              new_timeslot_id: slot.timeslot_id,
                              new_time: `${slot.start_time}-${slot.end_time}`,
                              new_date: dayData.date,
                              reason: `Rescheduled to ${slot.start_time}-${slot.end_time} on ${dayData.date}`
                         });

                         slot.available_spots--;
                         appointmentIndex++;
                    } else {
                         slotIndex++;
                    }
               }

               if (appointmentIndex >= appointments.length) break;
          }

          return {
               success: actions.length === appointments.length,
               reschedule_actions: actions
          };
     }

     /**
      * Move appointment to new time slot
      */
     private async rescheduleAppointment(appointmentId: number, newTimeslotId: number, reason: string) {
          const appointment = await this.appointmentRepository.findOne({
               where: { appointment_id: appointmentId },
               relations: ['time_slot']
          });

          if (!appointment) {
               throw new NotFoundException('Appointment not found');
          }

          const newTimeSlot = await this.timeslotRepository.findOne({
               where: { timeslot_id: newTimeslotId }
          });

          if (!newTimeSlot) {
               throw new NotFoundException('New time slot not found');
          }

          appointment.time_slot = newTimeSlot;
          appointment.notes = `${appointment.notes || ''} ${reason}`.trim();

          await this.appointmentRepository.save(appointment);
     }

     /**
      * Apply schedule shrinking and deactivate affected slots
      */
     private async applyShrinking(availability: DoctorAvailability, dto: {
          availability_id: number;
          new_start_time?: string;
          new_end_time?: string;
          reason?: string;
     }) {
          // Update availability times based on what's provided
          if (dto.new_end_time) {
               availability.consulting_end_time = dto.new_end_time;
          }

          if (dto.new_start_time) {
               availability.consulting_start_time = dto.new_start_time;
          }

          await this.availabilityRepository.save(availability);

          // Deactivate time slots that are outside the new range
          await this.deactivateSlots(availability.availability_id, dto);
     }

     /**
      * Deactivate slots based on what's being shrunk
      */
     private async deactivateSlots(availabilityId: number, dto: {
          availability_id: number;
          new_start_time?: string;
          new_end_time?: string;
          reason?: string;
     }) {
          let whereConditions: string[] = [];
          let parameters: any = { availabilityId };

          // Build conditions based on what's being shrunk
          if (dto.new_end_time) {
               // Deactivate slots that start after new end time
               whereConditions.push('start_time > :newEndTime');
               parameters.newEndTime = dto.new_end_time;
          }

          if (dto.new_start_time) {
               // Deactivate slots that end before new start time
               whereConditions.push('end_time < :newStartTime');
               parameters.newStartTime = dto.new_start_time;
          }

          if (whereConditions.length === 0) {
               return; // Nothing to deactivate
          }

          // Combine conditions with OR (slots outside either boundary should be deactivated)
          const whereCondition = `availability_id = :availabilityId AND (${whereConditions.join(' OR ')})`;

          await this.timeslotRepository
               .createQueryBuilder()
               .update(DoctorTimeSlot)
               .set({
                    status: TimeSlotStatus.BLOCKED,
                    is_deleted: true
               })
               .where(whereCondition, parameters)
               .execute();
     }

     // Convert Date object to string format
     private getDateString(date: Date | string): string {
          return date instanceof Date ? date.toISOString().split('T')[0] : String(date);
     }

     // Check if time slot belongs to doctor
     private async validateSlotOwnership(slotId: number, doctorId: number): Promise<DoctorTimeSlot> {
          const slot = await this.timeslotRepository.findOne({
               where: {
                    timeslot_id: slotId,
                    availability: { doctor: { user_id: doctorId } }
               },
               relations: ['availability', 'availability.doctor']
          });

          if (!slot) {
               throw new NotFoundException('Time slot not found or does not belong to this doctor');
          }

          return slot;
     }

     // Get appointments from specific time slot
     private async getAppointmentsFromSlot(slotId: number, appointmentId?: number) {
          const where: any = {
               time_slot: { timeslot_id: slotId },
               appointment_status: AppointmentStatus.SCHEDULED
          };

          if (appointmentId) {
               where.appointment_id = appointmentId;
          }

          return await this.appointmentRepository.find({
               where,
               relations: ['patient', 'patient.user', 'time_slot']
          });
     }

     // Calculate available capacity for a time slot with real-time accuracy
     private async getSlotAvailableCapacity(slotId: number): Promise<number> {
          const slot = await this.timeslotRepository.findOne({
               where: { timeslot_id: slotId },
               relations: ['appointments']
          });

          if (!slot) {
               throw new NotFoundException('Time slot not found');
          }

          // Count only SCHEDULED appointments for accurate capacity calculation
          const activeAppointments = slot.appointments?.filter(
               app => app.appointment_status === AppointmentStatus.SCHEDULED
          ).length || 0;

          const availableCapacity = slot.max_patients - activeAppointments;

          // Ensure slot status is consistent with current capacity
          await this.updateSlotStatus(slotId);

          return Math.max(0, availableCapacity); // Never return negative capacity
     }

     // Move appointment to different time slot with proper status management
     private async moveAppointmentToSlot(appointmentId: number, newSlotId: number, reason?: string) {
          const appointment = await this.appointmentRepository.findOne({
               where: { appointment_id: appointmentId },
               relations: ['time_slot']
          });

          if (!appointment) {
               throw new NotFoundException('Appointment not found');
          }

          const oldSlotId = appointment.time_slot.timeslot_id;
          const newSlot = await this.timeslotRepository.findOne({
               where: { timeslot_id: newSlotId }
          });

          if (!newSlot) {
               throw new NotFoundException('Target time slot not found');
          }

          // Update appointment to new slot
          appointment.time_slot = newSlot;
          if (reason) {
               appointment.notes = `${appointment.notes || ''} ${reason}`.trim();
          }

          await this.appointmentRepository.save(appointment);

          // Update slot statuses to maintain consistency
          await this.updateSlotStatus(oldSlotId);  // Source slot may become available
          await this.updateSlotStatus(newSlotId);  // Target slot may become booked
     }

     // Update slot status based on current appointment count (SOLID: Single Responsibility)
     private async updateSlotStatus(slotId: number): Promise<void> {
          const slot = await this.timeslotRepository.findOne({
               where: { timeslot_id: slotId },
               relations: ['appointments']
          });

          if (!slot) {
               return; // Slot not found, nothing to update
          }

          // Count active appointments (SCHEDULED status only)
          const activeAppointments = slot.appointments?.filter(
               app => app.appointment_status === AppointmentStatus.SCHEDULED
          ).length || 0;

          // Determine new status based on capacity
          let newStatus: TimeSlotStatus;
          if (activeAppointments >= slot.max_patients) {
               newStatus = TimeSlotStatus.BOOKED;
          } else if (slot.status === TimeSlotStatus.BLOCKED) {
               // Keep blocked status if explicitly set
               newStatus = TimeSlotStatus.BLOCKED;
          } else {
               newStatus = TimeSlotStatus.AVAILABLE;
          }

          // Update status only if changed (avoid unnecessary database calls)
          if (slot.status !== newStatus) {
               slot.status = newStatus;
               await this.timeslotRepository.save(slot);
          }
     }

     // Batch update multiple slot statuses for efficiency
     private async batchUpdateSlotStatuses(slotIds: number[]): Promise<void> {
          const promises = slotIds.map(slotId => this.updateSlotStatus(slotId));
          await Promise.all(promises);
     }
}
