import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { DoctorTimeSlot } from '../doctors/entities/doctor-time-slot.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { User } from '../auth/entities/user.entity';

@Module({
     imports: [
          TypeOrmModule.forFeature([
               Appointment,
               DoctorTimeSlot,
               Patient,
               Doctor,
               User,
          ]),
     ],
     controllers: [AppointmentController],
     providers: [AppointmentService],
     exports: [AppointmentService],
})
export class AppointmentModule { }
