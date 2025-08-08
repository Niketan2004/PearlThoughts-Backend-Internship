import {
     Controller,
     Get,
     Patch,
     Param,
     UseGuards,
     Req,
     ForbiddenException,
     Body,
     ParseIntPipe,
     HttpCode,
     HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { PatientService } from './patient.service';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtPayload } from '../auth/auth.service';
import { UserRole } from '../auth/enums/user.enums';

@Controller('api/patients')
export class PatientController {
     constructor(private readonly patientService: PatientService) { }

     // Get patient profile by ID (patient can only view their own profile)
     @Get(':id')
     @UseGuards(JwtAuthGuard)
     @HttpCode(HttpStatus.OK)
     async getPatientProfile(
          @Param('id', ParseIntPipe) id: number,
          @Req() req: Request
     ) {
          // Get authenticated user from JWT
          const user = req.user as JwtPayload;

          // Only patients can access patient profiles
          if (user.role !== UserRole.PATIENT) {
               throw new ForbiddenException('Access denied: Only patients can view patient profiles');
          }

          // Get patient record to verify ownership
          const patient = await this.patientService.getPatientByUserId(user.sub);

          // Ensure patient can only view their own profile
          if (patient.user_id !== id) {
               throw new ForbiddenException('Access denied: Can only view your own profile');
          }

          // Return patient profile data
          return this.patientService.getPatientProfile(id);
     }

     // Update patient profile (patient can only update their own profile)
     @Patch(':id')
     @UseGuards(JwtAuthGuard)
     @HttpCode(HttpStatus.OK)
     async updatePatientProfile(
          @Param('id', ParseIntPipe) id: number,
          @Body() updateDto: UpdatePatientDto,
          @Req() req: Request
     ) {
          // Get authenticated user from JWT
          const user = req.user as JwtPayload;

          // Only patients can update patient profiles
          if (user.role !== UserRole.PATIENT) {
               throw new ForbiddenException('Access denied: Only patients can update patient profiles');
          }

          // Get patient record to verify ownership
          const patient = await this.patientService.getPatientByUserId(user.sub);

          // Ensure patient can only update their own profile
          if (patient.user_id !== id) {
               throw new ForbiddenException('Access denied: Can only update your own profile');
          }

          // Update patient profile with provided data
          return this.patientService.updatePatientProfile(id, updateDto);
     }
}
