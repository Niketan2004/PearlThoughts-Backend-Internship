import {
     Body,
     Controller,
     Get,
     HttpCode,
     HttpStatus,
     Patch,
     Param,
     Post,
     Query,
     Req,
     UnauthorizedException,
     UseGuards,
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { NewAppointmentDto } from './dto/new-appointment.dto';
import { Request } from 'express';
import { JwtPayload } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../auth/enums/user.enums';
import { AppointmentStatus } from './enums/appointment-status.enum';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

/**
 * Appointment Controller
 * 
 * Handles all appointment-related HTTP requests including:
 * - Viewing appointments with optional status filtering
 * - Creating new appointment bookings
 * - Canceling appointments
 * - Rescheduling appointments (doctor-only)
 * 
 * All endpoints require JWT authentication and enforce role-based access control
 */
@Controller('api/v1/appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentController {
     constructor(private readonly appointmentService: AppointmentService) { }

     /**
      * Retrieve appointments for the authenticated user
      * 
      * Returns different appointment lists based on user role:
      * - Doctors: See their patients' appointments
      * - Patients: See their own appointments
      * 
      * @param req - Request object containing authenticated user information
      * @param status - Optional filter by appointment status
      * @returns List of appointments matching criteria
      */
     @Get()
     @HttpCode(HttpStatus.OK)
     async viewAppointments(
          @Req() req: Request,
          @Query('status') status?: AppointmentStatus,
     ) {
          // Get authenticated user from JWT token
          const user = req.user as JwtPayload;

          // Fetch appointments based on user role and optional status filter
          return this.appointmentService.viewAppointments(
               user.sub,
               user.role,
               status,
          );
     }

     /**
      * Create a new appointment booking
      * 
      * Allows patients to book appointments with doctors for available time slots.
      * Only patients can create appointments. The system validates:
      * - User has PATIENT role
      * - Selected doctor and time slot exist and are available
      * - Patient provides appointment reason
      * 
      * @param req - Request object containing authenticated patient information
      * @param dto - New appointment data including doctor ID, time slot, and reason
      * @returns Created appointment details with confirmation
      */
     @Post('new')
     @HttpCode(HttpStatus.CREATED)
     async newAppointment(@Req() req: Request, @Body() dto: NewAppointmentDto) {
          // Get authenticated user from JWT token
          const user = req.user as JwtPayload;

          // Only patients can create appointments
          if (user.role !== UserRole.PATIENT) {
               throw new UnauthorizedException('Only patients can create appointments');
          }

          // Create appointment using patient ID from token
          const patientId = user.sub;
          return this.appointmentService.newAppointment(patientId, dto);
     }

     /**
      * Cancel an existing appointment
      * 
      * Allows both patients and doctors to cancel appointments.
      * The system validates:
      * - User is either the patient who booked the appointment or the assigned doctor
      * - Appointment exists and is in a cancellable state
      * 
      * @param req - Request object containing authenticated user information
      * @param appointmentId - ID of the appointment to cancel
      * @returns Confirmation of cancellation with updated appointment status
      */
     @Patch(':appointmentId/cancel')
     @HttpCode(HttpStatus.OK)
     async cancelAppointment(
          @Req() req: Request,
          @Param('appointmentId') appointmentId: number,
     ) {
          const user = req.user as JwtPayload;
          return this.appointmentService.cancelAppointment(
               appointmentId,
               user.sub,
               user.role,
          );
     }

     /**
      * Reschedule an existing appointment
      * 
      * Allows doctors to reschedule appointments in two ways:
      * 1. Slot-to-slot rescheduling: Move appointment to a different time slot
      * 2. Time-shift rescheduling: Shift appointment time by minutes
      * 
      * Only doctors can reschedule appointments. The system validates:
      * - User has DOCTOR role
      * - Appointment exists and belongs to the doctor
      * - New time slot is available (for slot-to-slot reschedule)
      * - Handles capacity management and provides alternatives when slots are full
      * 
      * @param req - Request object containing authenticated doctor information
      * @param dto - Reschedule data with different options based on reschedule type
      * @returns Updated appointment details or alternatives if slot is full
      */
     @Patch('reschedule')
     @HttpCode(HttpStatus.OK)
     async rescheduleAppointment(
          @Req() req: Request,
          @Body() dto: RescheduleAppointmentDto,
     ) {
          const user = req.user as JwtPayload;
          if (user.role !== UserRole.DOCTOR) {
               throw new UnauthorizedException(
                    'Only doctors can reschedule appointments',
               );
          }
          return this.appointmentService.rescheduleAppointments(user.sub, dto);
     }
}
