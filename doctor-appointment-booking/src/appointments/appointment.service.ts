import {
     BadRequestException,
     ConflictException,
     Injectable,
     InternalServerErrorException,
     NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from './entities/appointment.entity';
import { DoctorTimeSlot } from '../doctors/entities/doctor-time-slot.entity';
import { TimeSlotStatus } from '../doctors/enums/availability.enums';
import { AppointmentStatus } from './enums/appointment-status.enum';
import { NewAppointmentDto } from './dto/new-appointment.dto';
import { UserRole } from '../auth/enums/user.enums';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { RescheduleType } from './enums/reschedule-type.enum';
import { TimeUtils } from '../common/utils/time.utils';

@Injectable()
export class AppointmentService {
     constructor(
          @InjectRepository(Appointment)
          private appointmentRepo: Repository<Appointment>,
          @InjectRepository(DoctorTimeSlot)
          private timeslotRepo: Repository<DoctorTimeSlot>,
          @InjectRepository(Patient)
          private patientRepo: Repository<Patient>,
     ) { }

     // Create new appointment for a patient
     async newAppointment(patientId: number, dto: NewAppointmentDto) {
          try {
               // Extract booking details from request
               const { doctor_id, timeslot_id } = dto;

               // Find the requested timeslot with related data
               const timeslot = await this.timeslotRepo.findOne({
                    where: { timeslot_id, is_deleted: false },
                    relations: ['doctor', 'doctor.user', 'availability'],
               });

               // Check if timeslot exists
               if (!timeslot) {
                    throw new NotFoundException('Time slot not found');
               }

               // Check if timeslot is still available for booking
               if (timeslot.status !== TimeSlotStatus.AVAILABLE) {
                    throw new ConflictException('Time slot is no longer available');
               }

               const availability = timeslot.availability;

               // Use comprehensive booking window validation
               this.validateBookingWindow(availability, timeslot);

               // Verify the timeslot belongs to the requested doctor
               if (timeslot.doctor.user_id !== doctor_id) {
                    throw new BadRequestException(
                         'Time slot does not belong to this doctor',
                    );
               }

               // Find the patient making the booking
               const patient = await this.patientRepo.findOne({
                    where: { user_id: patientId },
                    relations: ['user'],
               });

               if (!patient) {
                    throw new NotFoundException('Patient not found');
               }

               const { doctor } = timeslot;

               // Check if patient already has appointment with this doctor in same session
               const existingAppointmentInSession = await this.appointmentRepo.findOne({
                    where: {
                         patient: { user_id: patientId },
                         appointment_status: AppointmentStatus.SCHEDULED,
                         time_slot: {
                              doctor: { user_id: doctor.user_id },
                              availability: {
                                   date: availability.date,
                                   session: availability.session,
                              },
                         },
                    },
               });

               // Prevent duplicate bookings in same session
               if (existingAppointmentInSession) {
                    throw new ConflictException(
                         'You already have an appointment with this doctor in this session.',
                    );
               }

               // Check how many appointments are already booked for this timeslot
               const existingAppointmentsCount = await this.appointmentRepo.count({
                    where: {
                         appointment_status: AppointmentStatus.SCHEDULED,
                         time_slot: { timeslot_id: timeslot.timeslot_id },
                    },
               });

               // Check if timeslot has reached maximum capacity
               if (existingAppointmentsCount >= timeslot.max_patients) {
                    throw new ConflictException('This time slot is already full.');
               }

               // Calculate when patient should report (staggered timing)
               const reporting_time = this.calculateReportingTime(
                    timeslot,
                    existingAppointmentsCount,
               );

               // Create new appointment record
               const appointment = this.appointmentRepo.create({
                    doctor,
                    patient,
                    time_slot: timeslot,
                    appointment_status: AppointmentStatus.SCHEDULED,
                    scheduled_on: TimeUtils.combineDateAndTime(
                         availability.date,
                         reporting_time,
                    ),
                    reason: dto.reason,
                    notes: dto.notes,
               });

               // Save appointment to database
               await this.appointmentRepo.save(appointment);

               // Update slot status to maintain consistency (handles all status logic)
               await this.updateSlotStatusAfterBooking(timeslot_id);

               // Return success response with appointment details
               return {
                    message: 'Appointment booked successfully',
                    data: {
                         ...appointment,
                         scheduled_on:
                              appointment.scheduled_on.toDateString() +
                              ' ' +
                              appointment.scheduled_on.toTimeString().slice(0, 5),
                         doctor: {
                              ...doctor,
                              user: { profile: doctor.user.profile },
                         },
                         patient: {
                              ...patient,
                              user: { profile: patient.user.profile },
                         },
                         time_slot: {
                              timeslot_id: timeslot.timeslot_id,
                              start_time: timeslot.start_time,
                              end_time: timeslot.end_time,
                              availability: {
                                   availability_id: timeslot.availability.availability_id,
                                   date: timeslot.availability.date,
                                   session: timeslot.availability.session,
                                   consulting_start_time: timeslot.availability.consulting_start_time,
                                   consulting_end_time: timeslot.availability.consulting_end_time,
                              },
                         },
                    },
               };
          } catch (error) {
               // Re-throw known exceptions, wrap unknown ones
               if (
                    error instanceof NotFoundException ||
                    error instanceof ConflictException ||
                    error instanceof BadRequestException
               ) {
                    throw error;
               }
               throw new InternalServerErrorException('Error creating appointment');
          }
     }

     // View appointments based on user role and optional status filter
     async viewAppointments(
          userId: number,
          role: UserRole,
          status?: AppointmentStatus,
     ) {
          try {
               // Appointments for patient
               if (role === UserRole.PATIENT) {
                    if (status && status === AppointmentStatus.SCHEDULED) {
                         const appointments = await this.appointmentRepo.find({
                              where: {
                                   patient: { user_id: userId },
                                   appointment_status: AppointmentStatus.SCHEDULED,
                              },
                              relations: ['doctor', 'doctor.user', 'time_slot'],
                              order: { scheduled_on: 'ASC' },
                         });

                         return this.buildViewAppointmentResponse(
                              'your upcoming appointments',
                              appointments,
                              role,
                         );
                    }

                    if (status && status === AppointmentStatus.COMPLETED) {
                         const appointments = await this.appointmentRepo.find({
                              where: {
                                   patient: { user_id: userId },
                                   appointment_status: AppointmentStatus.COMPLETED,
                              },
                              relations: ['doctor', 'doctor.user', 'time_slot'],
                              order: { scheduled_on: 'DESC' },
                         });

                         return this.buildViewAppointmentResponse(
                              'your completed appointments',
                              appointments,
                              role,
                         );
                    }

                    if (status && status === AppointmentStatus.CANCELLED) {
                         const appointments = await this.appointmentRepo.find({
                              where: {
                                   patient: { user_id: userId },
                                   appointment_status: AppointmentStatus.CANCELLED,
                              },
                              relations: ['doctor', 'doctor.user', 'time_slot'],
                              order: { scheduled_on: 'DESC' },
                         });

                         return this.buildViewAppointmentResponse(
                              'your cancelled appointments',
                              appointments,
                              role,
                         );
                    }

                    const appointments = await this.appointmentRepo.find({
                         where: { patient: { user_id: userId } },
                         relations: ['doctor', 'doctor.user', 'time_slot'],
                         order: { scheduled_on: 'DESC' },
                    });

                    return this.buildViewAppointmentResponse(
                         'your all appointments',
                         appointments,
                         role,
                    );
               }
               // Appointments for doctor
               else if (role === UserRole.DOCTOR) {
                    if (status && status === AppointmentStatus.SCHEDULED) {
                         const appointments = await this.appointmentRepo.find({
                              where: {
                                   doctor: { user_id: userId },
                                   appointment_status: AppointmentStatus.SCHEDULED,
                              },
                              relations: ['patient', 'patient.user', 'time_slot'],
                              order: { scheduled_on: 'ASC' },
                         });

                         return this.buildViewAppointmentResponse(
                              'your upcoming appointments',
                              appointments,
                              role,
                         );
                    }

                    if (status && status === AppointmentStatus.COMPLETED) {
                         const appointments = await this.appointmentRepo.find({
                              where: {
                                   doctor: { user_id: userId },
                                   appointment_status: AppointmentStatus.COMPLETED,
                              },
                              relations: ['patient', 'patient.user', 'time_slot'],
                              order: { scheduled_on: 'DESC' },
                         });

                         return this.buildViewAppointmentResponse(
                              'your completed appointments',
                              appointments,
                              role,
                         );
                    }

                    if (status && status === AppointmentStatus.CANCELLED) {
                         const appointments = await this.appointmentRepo.find({
                              where: {
                                   doctor: { user_id: userId },
                                   appointment_status: AppointmentStatus.CANCELLED,
                              },
                              relations: ['patient', 'patient.user', 'time_slot'],
                              order: { scheduled_on: 'DESC' },
                         });

                         return this.buildViewAppointmentResponse(
                              'your cancelled appointments',
                              appointments,
                              role,
                         );
                    }

                    const appointments = await this.appointmentRepo.find({
                         where: { doctor: { user_id: userId } },
                         relations: ['patient', 'patient.user', 'time_slot'],
                         order: { scheduled_on: 'DESC' },
                    });

                    return this.buildViewAppointmentResponse(
                         'your all appointments',
                         appointments,
                         role,
                    );
               } else {
                    throw new BadRequestException('Invalid user role');
               }
          } catch (error) {
               if (error instanceof BadRequestException) {
                    throw error;
               }
               throw new InternalServerErrorException(
                    'Error fetching appointments',
               );
          }
     }

     async cancelAppointment(
          appointmentId: number,
          userId: number,
          role: UserRole,
     ) {
          try {
               const appointment = await this.appointmentRepo.findOne({
                    where: { appointment_id: appointmentId },
                    relations: ['doctor', 'patient', 'time_slot', 'time_slot.availability'],
               });

               if (!appointment) {
                    throw new NotFoundException('Appointment not found');
               }

               if (role === UserRole.PATIENT && appointment.patient.user_id !== userId) {
                    throw new ConflictException(
                         'You can only cancel your own appointments',
                    );
               }

               if (role === UserRole.DOCTOR && appointment.doctor.user_id !== userId) {
                    throw new ConflictException(
                         'You can only cancel your own appointments',
                    );
               }

               if (
                    appointment.appointment_status === AppointmentStatus.CANCELLED ||
                    appointment.appointment_status === AppointmentStatus.COMPLETED
               ) {
                    throw new ConflictException(
                         'Appointment already cancelled or completed',
                    );
               }

               const now = new Date();
               const consultStartAt = TimeUtils.combineDateAndTime(
                    appointment.time_slot.availability.date,
                    appointment.time_slot.start_time,
               );

               if (now >= consultStartAt) {
                    throw new ConflictException(
                         'You can only cancel appointments before the consultation starts',
                    );
               }

               appointment.appointment_status = AppointmentStatus.CANCELLED;
               await this.appointmentRepo.save(appointment);

               // Update slot status after cancellation to make it available again
               await this.updateSlotStatusAfterBooking(appointment.time_slot.timeslot_id);

               return {
                    message: 'Appointment cancelled successfully',
               };
          } catch (error) {
               if (
                    error instanceof NotFoundException ||
                    error instanceof ConflictException
               ) {
                    throw error;
               }
               throw new InternalServerErrorException('Error cancelling appointment');
          }
     }

     async rescheduleAppointments(
          doctorId: number,
          dto: RescheduleAppointmentDto,
     ) {
          try {
               // Check if this is a new slot-to-slot reschedule or time shift reschedule
               if (dto.new_timeslot_id && dto.appointment_id) {
                    return await this.rescheduleAppointmentToNewSlot(doctorId, dto);
               }

               // Original time-shift based rescheduling logic
               return await this.rescheduleAppointmentsByTimeShift(doctorId, dto);
          } catch (error) {
               if (
                    error instanceof NotFoundException ||
                    error instanceof BadRequestException ||
                    error instanceof ConflictException
               ) {
                    throw error;
               }
               throw new InternalServerErrorException('Error rescheduling appointment');
          }
     }

     /**
      * Reschedule a single appointment to a new time slot with capacity management
      */
     async rescheduleAppointmentToNewSlot(
          doctorId: number,
          dto: RescheduleAppointmentDto,
     ) {
          const { appointment_id, new_timeslot_id, reason } = dto;

          // Find the appointment to reschedule
          const appointment = await this.appointmentRepo.findOne({
               where: {
                    appointment_id,
                    doctor: { user_id: doctorId },
                    appointment_status: AppointmentStatus.SCHEDULED,
               },
               relations: [
                    'doctor',
                    'patient',
                    'time_slot',
                    'time_slot.availability',
               ],
          });

          if (!appointment) {
               throw new NotFoundException('Appointment not found or not authorized');
          }

          // Find the new time slot
          const newTimeSlot = await this.timeslotRepo.findOne({
               where: {
                    timeslot_id: new_timeslot_id,
                    doctor: { user_id: doctorId }, // Ensure slot belongs to same doctor
                    is_deleted: false,
               },
               relations: ['doctor', 'availability'],
          });

          if (!newTimeSlot) {
               throw new NotFoundException('New time slot not found');
          }

          // Check if new slot is available
          if (newTimeSlot.status !== TimeSlotStatus.AVAILABLE) {
               throw new ConflictException('New time slot is not available');
          }

          // Count existing appointments in new slot
          const existingAppointmentsInNewSlot = await this.appointmentRepo.count({
               where: {
                    appointment_status: AppointmentStatus.SCHEDULED,
                    time_slot: { timeslot_id: new_timeslot_id },
               },
          });

          // Check if new slot has capacity
          if (existingAppointmentsInNewSlot >= newTimeSlot.max_patients) {
               // Handle full slot scenario
               return await this.handleFullSlotReschedule(appointment, newTimeSlot, reason);
          }

          // Perform the reschedule
          const oldTimeSlot = appointment.time_slot;

          // Update appointment with new time slot
          appointment.time_slot = newTimeSlot;
          appointment.scheduled_on = TimeUtils.combineDateAndTime(
               newTimeSlot.availability.date,
               newTimeSlot.start_time,
          );

          if (reason) {
               appointment.notes = `Rescheduled: ${reason}. ${appointment.notes || ''}`.trim();
          }

          await this.appointmentRepo.save(appointment);

          // Update old slot capacity
          const remainingAppointmentsInOldSlot = await this.appointmentRepo.count({
               where: {
                    appointment_status: AppointmentStatus.SCHEDULED,
                    time_slot: { timeslot_id: oldTimeSlot.timeslot_id },
               },
          });

          if (remainingAppointmentsInOldSlot === 0) {
               oldTimeSlot.status = TimeSlotStatus.AVAILABLE;
               await this.timeslotRepo.save(oldTimeSlot);
          }

          // Update new slot capacity
          const newSlotAppointmentCount = await this.appointmentRepo.count({
               where: {
                    appointment_status: AppointmentStatus.SCHEDULED,
                    time_slot: { timeslot_id: new_timeslot_id },
               },
          });

          if (newSlotAppointmentCount >= newTimeSlot.max_patients) {
               newTimeSlot.status = TimeSlotStatus.BOOKED;
               await this.timeslotRepo.save(newTimeSlot);
          }

          return {
               message: 'Appointment rescheduled successfully',
               data: {
                    appointment_id: appointment.appointment_id,
                    old_slot: {
                         id: oldTimeSlot.timeslot_id,
                         time: `${oldTimeSlot.start_time} - ${oldTimeSlot.end_time}`,
                         date: oldTimeSlot.availability.date,
                    },
                    new_slot: {
                         id: newTimeSlot.timeslot_id,
                         time: `${newTimeSlot.start_time} - ${newTimeSlot.end_time}`,
                         date: newTimeSlot.availability.date,
                    },
                    new_scheduled_time: appointment.scheduled_on,
                    reason: reason || 'No reason provided',
               },
          };
     }

     /**
      * Handle rescheduling when target slot is full - provides alternatives
      */
     async handleFullSlotReschedule(
          appointment: Appointment,
          fullTimeSlot: DoctorTimeSlot,
          reason?: string,
     ) {
          const doctorId = appointment.doctor.user_id;
          const targetDate = fullTimeSlot.availability.date;

          // Find alternative slots on the same date
          const alternativeSlots = await this.timeslotRepo.find({
               where: {
                    doctor: { user_id: doctorId },
                    availability: { date: targetDate },
                    status: TimeSlotStatus.AVAILABLE,
                    is_deleted: false,
               },
               relations: ['availability'],
          });

          // Filter slots that have actual capacity
          const availableAlternatives: Array<{
               timeslot_id: number;
               time: string;
               available_spots: number;
               max_patients: number;
          }> = [];

          for (const slot of alternativeSlots) {
               const appointmentCount = await this.appointmentRepo.count({
                    where: {
                         appointment_status: AppointmentStatus.SCHEDULED,
                         time_slot: { timeslot_id: slot.timeslot_id },
                    },
               });

               if (appointmentCount < slot.max_patients) {
                    availableAlternatives.push({
                         timeslot_id: slot.timeslot_id,
                         time: `${slot.start_time} - ${slot.end_time}`,
                         available_spots: slot.max_patients - appointmentCount,
                         max_patients: slot.max_patients,
                    });
               }
          }

          throw new ConflictException({
               message: 'Target time slot is full. Please choose an alternative.',
               error_code: 'SLOT_FULL',
               target_slot: {
                    id: fullTimeSlot.timeslot_id,
                    time: `${fullTimeSlot.start_time} - ${fullTimeSlot.end_time}`,
                    date: fullTimeSlot.availability.date,
                    current_capacity: fullTimeSlot.max_patients,
               },
               appointment_details: {
                    id: appointment.appointment_id,
                    patient_name: appointment.patient.user.profile.full_name,
                    current_slot: {
                         id: appointment.time_slot.timeslot_id,
                         time: `${appointment.time_slot.start_time} - ${appointment.time_slot.end_time}`,
                         date: appointment.time_slot.availability.date,
                    },
               },
               alternative_slots: availableAlternatives,
               suggestions: [
                    'Choose one of the alternative time slots',
                    'Contact patient to discuss new timing',
                    'Consider extending consultation hours using scheduling adjustments',
               ],
          });
     }

     /**
      * Original time-shift based rescheduling method
      */
     async rescheduleAppointmentsByTimeShift(
          doctorId: number,
          dto: RescheduleAppointmentDto,
     ) {
          // Validate required fields for time shift
          if (!dto.shift_minutes || !dto.reschedule_type) {
               throw new BadRequestException('shift_minutes and reschedule_type are required for time-shift rescheduling');
          }

          // find appointments to reschedule
          let appointments: Appointment[];

          if (dto.appointment_ids && dto.appointment_ids.length > 0) {
               // find appointments that match the provided appointment_ids
               const appointmentsToReschedule = await this.appointmentRepo.find({
                    where: {
                         appointment_id: In(dto.appointment_ids),
                         doctor: { user_id: doctorId },
                         appointment_status: AppointmentStatus.SCHEDULED,
                    },
                    relations: [
                         'doctor',
                         'patient',
                         'time_slot',
                         'time_slot.availability',
                    ],
               });

               if (
                    !appointmentsToReschedule ||
                    appointmentsToReschedule.length === 0
               ) {
                    throw new NotFoundException('No appointments found');
               }
               appointments = appointmentsToReschedule;
          } else {
               // find all appointments that are scheduled for today
               const appointmentsToReschedule = await this.appointmentRepo.find({
                    where: {
                         doctor: { user_id: doctorId },
                         appointment_status: AppointmentStatus.SCHEDULED,
                         time_slot: {
                              availability: {
                                   date: new Date(new Date().toISOString().split('T')[0]), // today's date
                              },
                         },
                    },
                    relations: [
                         'doctor',
                         'patient',
                         'time_slot',
                         'time_slot.availability',
                    ],
               });

               if (
                    !appointmentsToReschedule ||
                    appointmentsToReschedule.length === 0
               ) {
                    throw new NotFoundException('No appointments found');
               }
               appointments = appointmentsToReschedule;
          }

          appointments.forEach((appointment) => {
               const shift =
                    dto.reschedule_type === RescheduleType.POSTPONE
                         ? dto.shift_minutes!
                         : -dto.shift_minutes!;
               // Apply the time shift to the scheduled_on time
               appointment.scheduled_on = new Date(
                    appointment.scheduled_on.getTime() + shift * 60 * 1000,
               );
          });

          // Save the updated appointments
          await this.appointmentRepo.save(appointments);

          return {
               message: 'Appointments rescheduled successfully',
          };
     }

     // Calculate staggered reporting time for patients in the same timeslot
     private calculateReportingTime(timeslot: DoctorTimeSlot, patientIndex: number): string {
          const [startHour, startMinute] = timeslot.start_time.split(':').map(Number);
          const [endHour, endMinute] = timeslot.end_time.split(':').map(Number);

          const startDate = new Date(2000, 0, 1, startHour, startMinute);
          const endDate = new Date(2000, 0, 1, endHour, endMinute);
          const slotDuration = (endDate.getTime() - startDate.getTime()) / (1000 * 60); // minutes

          const timePerPatient = Math.floor(slotDuration / timeslot.max_patients);
          const reportingDate = new Date(startDate.getTime() + patientIndex * timePerPatient * 60 * 1000);

          return `${reportingDate.getHours().toString().padStart(2, '0')}:${reportingDate.getMinutes().toString().padStart(2, '0')}`;
     }

     // Format appointment data for API response
     private buildViewAppointmentResponse(
          message: string,
          appointments: Appointment[],
          role: UserRole,
     ) {
          const data = appointments.map((appointment) => {
               return {
                    appointment_id: appointment.appointment_id,
                    appointment_status: appointment.appointment_status,
                    scheduled_on:
                         appointment.scheduled_on.toDateString() +
                         ' ' +
                         appointment.scheduled_on.toTimeString().slice(0, 5),
                    reason: appointment.reason,
                    notes: appointment.notes,
                    ...(role === UserRole.PATIENT
                         ? {
                              doctor: {
                                   ...appointment.doctor,
                                   user: {
                                        profile: appointment.doctor?.user.profile,
                                   },
                              },
                         }
                         : {
                              patient: {
                                   ...appointment.patient,
                                   user: {
                                        profile: appointment.patient?.user.profile,
                                   },
                              },
                         }),
               };
          });

          return {
               message,
               total: data.length,
               data,
          };
     }

     // Update slot status based on current appointment count (SOLID: Single Responsibility)
     private async updateSlotStatusAfterBooking(slotId: number): Promise<void> {
          try {
               const slot = await this.timeslotRepo.findOne({
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
                    await this.timeslotRepo.save(slot);
               }
          } catch (error) {
               // Silently handle slot status update errors to prevent appointment operation failures
          }
     }

     /**
      * Comprehensive booking window validation helper method
      * Ensures strict adherence to booking time windows
      */
     private validateBookingWindow(
          availability: any,
          timeslot: DoctorTimeSlot,
          currentTime: Date = new Date()
     ): void {
          const appointmentDateTime = TimeUtils.combineDateAndTime(availability.date, timeslot.start_time);

          // Check if trying to book a past timeslot
          if (currentTime >= appointmentDateTime) {
               throw new ConflictException('Cannot book appointment for past timeslots');
          }

          // Booking window must be configured
          if (!availability.booking_start_at || !availability.booking_end_at) {
               throw new ConflictException(
                    'Booking window is not configured for this availability. Please contact the doctor.'
               );
          }

          const bookingStartTime = new Date(availability.booking_start_at);
          const bookingEndTime = new Date(availability.booking_end_at);

          // Validate booking window configuration integrity
          if (bookingStartTime >= bookingEndTime) {
               throw new ConflictException(
                    'Invalid booking window configuration: start time must be before end time'
               );
          }

          if (bookingEndTime >= appointmentDateTime) {
               throw new ConflictException(
                    'Invalid booking window configuration: booking window should close before appointment time'
               );
          }

          // Strict booking window enforcement
          const isBeforeWindow = currentTime < bookingStartTime;
          const isAfterWindow = currentTime > bookingEndTime;

          if (isBeforeWindow) {
               const minutesUntilOpening = Math.ceil((bookingStartTime.getTime() - currentTime.getTime()) / (1000 * 60));
               throw new ConflictException({
                    message: 'Booking window has not opened yet. You can only book appointments within the designated booking window.',
                    error_code: 'BOOKING_WINDOW_NOT_OPEN',
                    current_time: currentTime.toLocaleString(),
                    booking_window: {
                         opens_at: bookingStartTime.toLocaleString(),
                         closes_at: bookingEndTime.toLocaleString(),
                         minutes_until_opening: minutesUntilOpening,
                    },
                    appointment_details: {
                         date: availability.date.toDateString(),
                         time: `${timeslot.start_time} - ${timeslot.end_time}`,
                         session: availability.session,
                    }
               });
          }

          if (isAfterWindow) {
               const minutesAfterClosure = Math.ceil((currentTime.getTime() - bookingEndTime.getTime()) / (1000 * 60));
               throw new ConflictException({
                    message: 'Booking window has closed. You can only book appointments within the designated booking window.',
                    error_code: 'BOOKING_WINDOW_CLOSED',
                    current_time: currentTime.toLocaleString(),
                    booking_window: {
                         opened_at: bookingStartTime.toLocaleString(),
                         closed_at: bookingEndTime.toLocaleString(),
                         minutes_after_closure: minutesAfterClosure,
                    },
                    appointment_details: {
                         date: availability.date.toDateString(),
                         time: `${timeslot.start_time} - ${timeslot.end_time}`,
                         session: availability.session,
                    },
                    suggestions: [
                         'Contact the doctor for emergency appointments',
                         'Check for other available dates with open booking windows',
                         'Book appointments in advance during booking windows'
                    ]
               });
          }
     }
}
