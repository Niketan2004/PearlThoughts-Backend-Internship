import {
     BadRequestException,
     ConflictException,
     Injectable,
     InternalServerErrorException,
     NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere, Not, In } from 'typeorm';
import { Doctor } from './entities/doctor.entity';
import { CreateDoctorAvailabilityDto, UpdateDoctorAvailabilityDto } from './dto/create-availability.dto';
import { CreateTimeslotDto, UpdateTimeslotDto } from './dto/create-timeslot.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DoctorAvailability } from './entities/doctor-availability.entity';
import { DoctorTimeSlot } from './entities/doctor-time-slot.entity';
import { TimeUtils } from '../common/utils/time.utils';
import { TimeSlotStatus, Weekday } from './enums/availability.enums';
import { ScheduleType } from './enums/schedule-type.enums';
import { Appointment } from '../appointments/entities/appointment.entity';
import { AppointmentStatus } from '../appointments/enums/appointment-status.enum';

@Injectable()
export class DoctorService {
     constructor(
          @InjectRepository(Doctor)
          private doctorRepo: Repository<Doctor>,
          @InjectRepository(DoctorAvailability)
          private availabilityRepo: Repository<DoctorAvailability>,
          @InjectRepository(DoctorTimeSlot)
          private timeslotRepo: Repository<DoctorTimeSlot>,
          @InjectRepository(Appointment)
          private appointmentRepo: Repository<Appointment>,
     ) { }

     // Get doctor profile information
     async getProfile(doctorId: number) {
          try {
               // Find doctor with user details
               const doctor = await this.doctorRepo.findOne({
                    where: { user_id: doctorId },
                    relations: ['user'],
               });

               // Check if doctor exists
               if (!doctor) {
                    throw new NotFoundException('Doctor not found');
               }

               // Return doctor profile data
               return {
                    message: 'Doctor profile retrieved successfully',
                    data: {
                         ...doctor,
                         user: doctor.user.profile,
                    },
               };
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error retrieving doctor profile');
          }
     }

     // Get doctor record by user ID (internal method)
     async getDoctorByUserId(userId: number) {
          try {
               // Find doctor by user ID with user details
               const doctor = await this.doctorRepo.findOne({
                    where: { user_id: userId },
                    relations: ['user'],
               });

               // Check if doctor exists
               if (!doctor) {
                    throw new NotFoundException('Doctor not found');
               }

               return doctor;
          } catch (error) {
               // Re-throw known exceptions, wrap unknown ones
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error retrieving doctor');
          }
     }

     async getDoctorDetails(doctorId: number) {
          try {
               const doctor = await this.doctorRepo.findOne({
                    where: { user_id: doctorId },
                    relations: ['user'],
               });

               if (!doctor) {
                    throw new NotFoundException('Doctor not found');
               }

               return {
                    message: 'Doctor details retrieved successfully',
                    data: {
                         ...doctor,
                         user: doctor.user.profile,
                    },
               };
          } catch (error) {
               // Re-throw known exceptions, wrap unknown ones
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error retrieving doctor details');
          }
     }

     // Search doctors by name, specialization, or clinic
     async searchDoctors(query?: string) {
          try {
               // Build query with user join
               const queryBuilder = this.doctorRepo
                    .createQueryBuilder('doctor')
                    .leftJoinAndSelect('doctor.user', 'user');

               // Add search filters if query provided
               if (query) {
                    queryBuilder.where(
                         'user.full_name ILIKE :query OR doctor.specialization ILIKE :query OR doctor.clinic_name ILIKE :query',
                         { query: `%${query}%` }
                    );
               }

               queryBuilder.select([
                    'doctor.user_id',
                    'doctor.specialization',
                    'doctor.experience_years',
                    'doctor.clinic_name',
                    'doctor.clinic_address',
                    'doctor.consultation_fee',
                    'user.user_id',
                    'user.full_name',
                    'user.profile_picture',
               ]);

               const doctors = await queryBuilder.getMany();

               return {
                    message: 'Doctors retrieved successfully',
                    total: doctors.length,
                    data: doctors.map(doctor => ({
                         ...doctor,
                         user: doctor.user.profile,
                    })),
               };
          } catch (error) {
               throw new InternalServerErrorException('Error searching doctors');
          }
     }

     // Create new availability slots for a doctor
     async newAvailability(doctorId: number, dto: CreateDoctorAvailabilityDto) {
          try {
               // Find the doctor
               const doctor = await this.doctorRepo.findOne({
                    where: { user_id: doctorId },
               });

               if (!doctor) {
                    throw new NotFoundException('Doctor not found');
               }

               // Validate and process availability dates
               const { bookingStartAt, bookingEndAt, datesToCreate } = this.validateAvailabilityDates(dto);

               const availabilities: DoctorAvailability[] = [];

               for (const date of datesToCreate) {
                    const availability = this.availabilityRepo.create({
                         doctor,
                         date,
                         consulting_start_time: dto.consulting_start_time,
                         consulting_end_time: dto.consulting_end_time,
                         session: dto.session,
                         weekdays: dto.weekdays,
                         booking_start_at: bookingStartAt,
                         booking_end_at: bookingEndAt,
                    });

                    const savedAvailability = await this.availabilityRepo.save(availability);
                    availabilities.push(savedAvailability);
               }

               return {
                    message: 'Availability created successfully',
                    data: availabilities,
               };
          } catch (error) {
               if (
                    error instanceof NotFoundException ||
                    error instanceof BadRequestException
               ) {
                    throw error;
               }
               throw new InternalServerErrorException('Error creating availability');
          }
     }

     async updateAvailability(
          doctorId: number,
          availabilityId: number,
          dto: UpdateDoctorAvailabilityDto,
     ) {
          try {
               const availability = await this.availabilityRepo.findOne({
                    where: {
                         availability_id: availabilityId,
                         doctor: { user_id: doctorId },
                         is_deleted: false,
                    },
                    relations: ['doctor'],
               });

               if (!availability) {
                    throw new NotFoundException('Availability not found');
               }

               // Update fields if provided
               if (dto.date) availability.date = dto.date;
               if (dto.consulting_start_time) availability.consulting_start_time = dto.consulting_start_time;
               if (dto.consulting_end_time) availability.consulting_end_time = dto.consulting_end_time;
               if (dto.session) availability.session = dto.session;
               if (dto.weekdays) availability.weekdays = dto.weekdays;
               if (dto.booking_start_at) availability.booking_start_at = new Date(dto.booking_start_at);
               if (dto.booking_end_at) availability.booking_end_at = new Date(dto.booking_end_at);

               const updatedAvailability = await this.availabilityRepo.save(availability);

               return {
                    message: 'Availability updated successfully',
                    data: updatedAvailability,
               };
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error updating availability');
          }
     }

     async softDeleteAvailability(doctorId: number, availabilityId: number) {
          try {
               const availability = await this.availabilityRepo.findOne({
                    where: {
                         availability_id: availabilityId,
                         doctor: { user_id: doctorId },
                         is_deleted: false,
                    },
               });

               if (!availability) {
                    throw new NotFoundException('Availability not found');
               }

               availability.is_deleted = true;
               await this.availabilityRepo.save(availability);

               return {
                    message: 'Availability deleted successfully',
                    availability_id: availabilityId,
               };
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error deleting availability');
          }
     }

     // Timeslot management
     async newTimeslot(doctorId: number, dto: CreateTimeslotDto) {
          try {
               const availability = await this.availabilityRepo.findOne({
                    where: {
                         availability_id: dto.availability_id,
                         doctor: { user_id: doctorId },
                         is_deleted: false,
                    },
                    relations: ['doctor'],
               });

               if (!availability) {
                    throw new NotFoundException('Availability not found');
               }

               const timeslot = this.timeslotRepo.create({
                    doctor: availability.doctor,
                    availability,
                    start_time: dto.start_time,
                    end_time: dto.end_time,
                    max_patients: dto.max_patients,
                    status: TimeSlotStatus.AVAILABLE,
               });

               const savedTimeslot = await this.timeslotRepo.save(timeslot);

               return {
                    message: 'Time slot created successfully',
                    data: savedTimeslot,
               };
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error creating timeslot');
          }
     }

     async updateTimeslot(doctorId: number, timeslotId: number, dto: UpdateTimeslotDto) {
          try {
               const timeslot = await this.timeslotRepo.findOne({
                    where: {
                         timeslot_id: timeslotId,
                         doctor: { user_id: doctorId },
                         is_deleted: false,
                    },
               });

               if (!timeslot) {
                    throw new NotFoundException('Time slot not found');
               }

               if (dto.start_time) timeslot.start_time = dto.start_time;
               if (dto.end_time) timeslot.end_time = dto.end_time;
               if (dto.max_patients) timeslot.max_patients = dto.max_patients;

               const updatedTimeslot = await this.timeslotRepo.save(timeslot);

               return {
                    message: 'Time slot updated successfully',
                    data: updatedTimeslot,
               };
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error updating timeslot');
          }
     }

     async softDeleteTimeslot(doctorId: number, timeslotId: number) {
          try {
               const timeslot = await this.timeslotRepo.findOne({
                    where: {
                         timeslot_id: timeslotId,
                         doctor: { user_id: doctorId },
                         is_deleted: false,
                    },
               });

               if (!timeslot) {
                    throw new NotFoundException('Time slot not found');
               }

               timeslot.is_deleted = true;
               await this.timeslotRepo.save(timeslot);

               return {
                    message: 'Time slot deleted successfully',
                    timeslot_id: timeslotId,
               };
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error deleting timeslot');
          }
     }

     async getAvailableTimeSlots(doctorId: number, page: number, limit: number) {
          try {
               const skip = (page - 1) * limit;

               // Get all non-deleted slots first
               const allSlots = await this.timeslotRepo.find({
                    where: {
                         doctor: { user_id: doctorId },
                         is_deleted: false,
                    },
                    relations: ['availability', 'appointments'],
                    order: {
                         availability: { date: 'ASC' },
                         start_time: 'ASC',
                    },
               });

               // Filter slots that actually have available capacity
               const availableSlots = allSlots.filter(slot => {
                    const activeAppointments = slot.appointments?.filter(
                         app => app.appointment_status === AppointmentStatus.SCHEDULED
                    ).length || 0;

                    return activeAppointments < slot.max_patients &&
                         slot.status !== TimeSlotStatus.BLOCKED;
               });

               // Update slot statuses to ensure consistency
               const statusUpdatePromises = allSlots.map(slot => {
                    const activeAppointments = slot.appointments?.filter(
                         app => app.appointment_status === AppointmentStatus.SCHEDULED
                    ).length || 0;

                    let newStatus: TimeSlotStatus;
                    if (activeAppointments >= slot.max_patients) {
                         newStatus = TimeSlotStatus.BOOKED;
                    } else if (slot.status === TimeSlotStatus.BLOCKED) {
                         newStatus = TimeSlotStatus.BLOCKED;
                    } else {
                         newStatus = TimeSlotStatus.AVAILABLE;
                    }

                    if (slot.status !== newStatus) {
                         slot.status = newStatus;
                         return this.timeslotRepo.save(slot);
                    }
                    return Promise.resolve();
               });

               await Promise.all(statusUpdatePromises);

               // Apply pagination to available slots
               const paginatedSlots = availableSlots.slice(skip, skip + limit);

               // Add capacity information to response
               const slotsWithCapacity = paginatedSlots.map(slot => {
                    const activeAppointments = slot.appointments?.filter(
                         app => app.appointment_status === AppointmentStatus.SCHEDULED
                    ).length || 0;

                    return {
                         ...slot,
                         current_bookings: activeAppointments,
                         available_capacity: slot.max_patients - activeAppointments,
                         is_full: activeAppointments >= slot.max_patients
                    };
               });

               return {
                    message: 'Available time slots retrieved successfully',
                    total: availableSlots.length,
                    page,
                    limit,
                    data: slotsWithCapacity,
               };
          } catch (error) {
               throw new InternalServerErrorException('Error retrieving time slots');
          }
     }

     async updateScheduleType(doctorId: number, scheduleType: ScheduleType) {
          try {
               const doctor = await this.doctorRepo.findOne({
                    where: { user_id: doctorId },
               });

               if (!doctor) {
                    throw new NotFoundException('Doctor not found');
               }

               doctor.schedule_type = scheduleType;
               await this.doctorRepo.save(doctor);

               return {
                    message: 'Schedule type updated successfully',
               };
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error updating schedule type');
          }
     }

     // Helper functions
     private generateDatesForWeekdays(weekdays: Weekday[], weeksAhead: number): Date[] {
          const dates: Date[] = [];
          const today = new Date();

          for (let i = 0; i < weeksAhead * 7; i++) {
               const date = new Date(today);
               date.setDate(today.getDate() + i);

               const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
               if (weekdays.includes(dayName as Weekday)) {
                    dates.push(date);
               }
          }

          return dates;
     }

     private validateAvailabilityDates(dto: CreateDoctorAvailabilityDto) {
          // Set default booking windows if not provided
          // Booking starts immediately and patients can book up until the timeslot starts
          const now = new Date();
          let bookingStartAt: Date;
          let bookingEndAt: Date;

          if (dto.booking_start_at) {
               bookingStartAt = new Date(dto.booking_start_at);
          } else {
               // Default: Can start booking immediately
               bookingStartAt = now;
          }

          // Reset time to start of day for fair comparison
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (bookingStartAt < today) {
               throw new BadRequestException('Booking cannot start in the past');
          }

          let datesToCreate: Date[] = [];
          if (dto.date) {
               // Validate that the consultation date is not in the past
               const consultationDate = new Date(dto.date);
               consultationDate.setHours(0, 0, 0, 0);
               if (consultationDate < today) {
                    throw new BadRequestException('Consultation date cannot be in the past');
               }
               datesToCreate = [dto.date];
          } else if (dto.weekdays && dto.weekdays.length > 0) {
               datesToCreate = this.generateDatesForWeekdays(dto.weekdays, 4); // Generate dates for next 4 weeks
          }

          // Set booking end time based on consultation times
          if (dto.booking_end_at) {
               bookingEndAt = new Date(dto.booking_end_at);

               // Validate that booking period ends before consulting starts (for each date)
               for (const date of datesToCreate) {
                    const consulting_start_at = TimeUtils.combineDateAndTime(
                         date,
                         dto.consulting_start_time,
                    );

                    if (bookingEndAt >= consulting_start_at) {
                         throw new BadRequestException(
                              `Booking end time must be before consulting start time (${consulting_start_at.toLocaleString()})`,
                         );
                    }
               }
          } else {
               // Default: Patients can book up until the timeslot starts
               // We'll set this to a far future date and handle it in the appointment booking logic
               bookingEndAt = new Date('2099-12-31T23:59:59.999Z');
          }

          if (bookingStartAt >= bookingEndAt && dto.booking_end_at) {
               throw new BadRequestException(
                    'Booking start time must be before booking end time',
               );
          }

          return {
               bookingStartAt,
               bookingEndAt,
               datesToCreate,
          };
     }

     async updateDoctorProfile(doctorId: number, updateData: UpdateDoctorDto) {
          try {
               const doctor = await this.doctorRepo.findOne({
                    where: { user_id: doctorId },
                    relations: ['user'],
               });

               if (!doctor) {
                    throw new NotFoundException('Doctor not found');
               }

               // Update only provided fields
               Object.assign(doctor, updateData);
               const updatedDoctor = await this.doctorRepo.save(doctor);

               return {
                    message: 'Doctor profile updated successfully',
                    data: updatedDoctor,
               };
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error updating doctor profile');
          }
     }

     async getDoctorSlots(doctorId: number) {
          try {
               const slots = await this.getAvailableTimeSlots(doctorId, 1, 50);
               return slots;
          } catch (error) {
               throw new InternalServerErrorException('Error retrieving doctor slots');
          }
     }

     async deleteSlot(slotId: number) {
          try {
               const slot = await this.timeslotRepo.findOne({
                    where: { timeslot_id: slotId },
                    relations: ['availability', 'availability.doctor'],
               });

               if (!slot) {
                    throw new NotFoundException('Slot not found');
               }

               const doctorId = slot.availability.doctor.user_id;
               return await this.softDeleteTimeslot(doctorId, slotId);
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error deleting slot');
          }
     }
}
