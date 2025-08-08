import {
     Controller,
     Get,
     Param,
     UseGuards,
     Req,
     ForbiddenException,
     Post,
     Body,
     Patch,
     ParseIntPipe,
     HttpCode,
     HttpStatus,
     Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { DoctorService } from './doctor.service';
import { ScheduleService } from './services/schedule.service';
import { JwtPayload } from '../auth/auth.service';
import { UserRole } from '../auth/enums/user.enums';
import { CreateDoctorAvailabilityDto } from './dto/create-availability.dto';
import { CreateTimeslotDto } from './dto/create-timeslot.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { UnifiedRescheduleDto } from './dto/schedule-operations.dto';
import { ScheduleType } from './enums/schedule-type.enums';

// Doctor Controller - handles all doctor-related HTTP requests
// Includes: public doctor listing, profile management, availability & scheduling
@Controller('api/doctors')
export class DoctorController {
     constructor(
          private readonly doctorService: DoctorService,
          private readonly scheduleService: ScheduleService
     ) { }

     /**
      * Get all doctors (public endpoint)
      * 
      * Returns a list of all registered doctors with basic profile information.
      * This is a public endpoint used for doctor discovery and search functionality.
      * 
      * @returns List of all doctors with public profile information
      */
     // Get all doctors (public endpoint)
     @Get()
     @HttpCode(HttpStatus.OK)
     async getAllDoctors() {
          return this.doctorService.searchDoctors();
     }

     /**
      * Get doctor profile by ID (public endpoint)
      * 
      * Returns detailed public information about a specific doctor.
      * Includes specialization, experience, clinic details, and consultation fees.
      * 
      * @param id - Doctor's user ID
      * @returns Detailed doctor profile information
      */
     @Get(':id')
     @HttpCode(HttpStatus.OK)
     async getDoctorProfile(@Param('id', ParseIntPipe) id: number) {
          return this.doctorService.getDoctorDetails(id);
     }

     /**
      * Update doctor profile (authenticated doctors only)
      * 
      * Allows doctors to update their own profile information including
      * medical credentials, clinic details, and consultation fees.
      * 
      * @param id - Doctor's user ID
      * @param updateDto - Profile update data
      * @param req - Request object containing authenticated user information
      * @returns Updated doctor profile
      */
     @Patch(':id')
     @UseGuards(JwtAuthGuard)
     @HttpCode(HttpStatus.OK)
     async updateDoctorProfile(
          @Param('id', ParseIntPipe) id: number,
          @Body() updateDto: UpdateDoctorDto,
          @Req() req: Request
     ) {
          const user = req.user as JwtPayload;
          if (user.role !== UserRole.DOCTOR) {
               throw new ForbiddenException('Access denied: Only doctors can update profiles');
          }

          // Ensure doctor can only update their own profile
          const doctor = await this.doctorService.getDoctorByUserId(user.sub);
          if (doctor.user_id !== id) {
               throw new ForbiddenException('Access denied: Can only update your own profile');
          }

          return this.doctorService.updateDoctorProfile(id, updateDto);
     }

     // GET /api/doctors/:id/slots - Get all available slots
     @Get(':id/slots')
     @HttpCode(HttpStatus.OK)
     async getDoctorSlots(@Param('id', ParseIntPipe) id: number) {
          return this.doctorService.getDoctorSlots(id);
     }

     // DELETE /api/doctors/:id/slots/:slotId - Delete a slot
     @Delete(':id/slots/:slotId')
     @UseGuards(JwtAuthGuard)
     @HttpCode(HttpStatus.OK)
     async deleteSlot(
          @Param('id', ParseIntPipe) id: number,
          @Param('slotId', ParseIntPipe) slotId: number,
          @Req() req: Request
     ) {
          const user = req.user as JwtPayload;
          if (user.role !== UserRole.DOCTOR) {
               throw new ForbiddenException('Access denied: Only doctors can delete slots');
          }

          // Ensure doctor can only delete their own slots
          const doctor = await this.doctorService.getDoctorByUserId(user.sub);
          if (doctor.user_id !== id) {
               throw new ForbiddenException('Access denied: Can only delete your own slots');
          }

          return this.doctorService.deleteSlot(slotId);
     }

     /**
      * Create doctor availability (authenticated doctors only)
      * 
      * Creates availability windows for doctors to define when they are available for consultations.
      * Availability includes date, consulting hours, session type, and booking window.
      * 
      * @param createAvailabilityDto - Availability data including date, time slots, and booking windows
      * @param req - Request object containing authenticated user information
      * @returns Created availability information
      */
     @Post('availability')
     @UseGuards(JwtAuthGuard)
     @HttpCode(HttpStatus.CREATED)
     async createAvailability(
          @Body() createAvailabilityDto: CreateDoctorAvailabilityDto,
          @Req() req: Request
     ) {
          const user = req.user as JwtPayload;
          if (user.role !== UserRole.DOCTOR) {
               throw new ForbiddenException('Access denied: Only doctors can create availability');
          }

          const doctor = await this.doctorService.getDoctorByUserId(user.sub);
          return this.doctorService.newAvailability(doctor.user_id, createAvailabilityDto);
     }

     /**
      * Create time slot within availability (authenticated doctors only)
      * 
      * Creates individual time slots within existing availability windows.
      * Each time slot defines specific appointment times and maximum patient capacity.
      * 
      * @param createTimeslotDto - Time slot data including availability ID, start/end times, and capacity
      * @param req - Request object containing authenticated user information
      * @returns Created time slot information
      */
     @Post('timeslot')
     @UseGuards(JwtAuthGuard)
     @HttpCode(HttpStatus.CREATED)
     async createTimeslot(
          @Body() createTimeslotDto: CreateTimeslotDto,
          @Req() req: Request
     ) {
          const user = req.user as JwtPayload;
          if (user.role !== UserRole.DOCTOR) {
               throw new ForbiddenException('Access denied: Only doctors can create time slots');
          }

          const doctor = await this.doctorService.getDoctorByUserId(user.sub);
          return this.doctorService.newTimeslot(doctor.user_id, createTimeslotDto);
     }

     /**
      * Update doctor's schedule type (authenticated doctors only)
      * 
      * Updates how the doctor's appointments are scheduled (stream vs wave mode).
      * Stream mode: One patient at a time, Wave mode: Multiple patients per slot.
      * 
      * @param updateData - Schedule type configuration
      * @param req - Request object containing authenticated user information
      * @returns Updated schedule type information
      */
     @Patch('schedule_type')
     @UseGuards(JwtAuthGuard)
     @HttpCode(HttpStatus.OK)
     async updateScheduleType(
          @Body() updateData: { schedule_type: ScheduleType },
          @Req() req: Request
     ) {
          const user = req.user as JwtPayload;
          if (user.role !== UserRole.DOCTOR) {
               throw new ForbiddenException('Access denied: Only doctors can update schedule type');
          }

          const doctor = await this.doctorService.getDoctorByUserId(user.sub);
          return this.doctorService.updateScheduleType(doctor.user_id, updateData.schedule_type);
     }

     /**
      * Unified reschedule endpoint (authenticated doctors only)
      * 
      * Handles all types of rescheduling operations in a single endpoint:
      * - SLOT_SLOT: Move appointments between time slots
      * - TIME_SHIFT: Shift entire schedule by time offset
      * - SHRINKING: Reduce schedule by changing start/end times
      * 
      * The operation type is determined by the scheduling_type field in the request body.
      * Required fields vary based on the operation type.
      * 
      * @param doctorId - Doctor's user ID from the URL parameter
      * @param rescheduleDto - Unified reschedule data with operation type and parameters
      * @param req - Request object containing authenticated user information
      * @returns Result of the rescheduling operation with details
      */
     @Post(':doctorId/reschedule')
     @UseGuards(JwtAuthGuard)
     @HttpCode(HttpStatus.OK)
     async unifiedReschedule(
          @Param('doctorId', ParseIntPipe) doctorId: number,
          @Body() rescheduleDto: UnifiedRescheduleDto,
          @Req() req: Request
     ) {
          const user = req.user as JwtPayload;

          // Only allow doctors to reschedule their own appointments
          if (user.role !== UserRole.DOCTOR) {
               throw new ForbiddenException('Access denied: Only doctors can perform rescheduling operations');
          }

          // Verify the doctor is trying to reschedule their own schedule
          const doctor = await this.doctorService.getDoctorByUserId(user.sub);
          if (doctor.user_id !== doctorId) {
               throw new ForbiddenException('Access denied: You can only reschedule your own appointments');
          }

          return this.scheduleService.unifiedReschedule(doctorId, rescheduleDto);
     }
}
