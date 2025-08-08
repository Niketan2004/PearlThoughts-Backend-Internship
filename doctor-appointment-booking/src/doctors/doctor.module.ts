import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from './entities/doctor.entity';
import { DoctorController } from './doctor.controller';
import { DoctorAvailability } from './entities/doctor-availability.entity';
import { DoctorTimeSlot } from './entities/doctor-time-slot.entity';
import { DoctorService } from './doctor.service';
import { Appointment } from '../appointments/entities/appointment.entity';
import { ScheduleService } from './services/schedule.service';

@Module({
     imports: [
          TypeOrmModule.forFeature([
               Doctor,
               DoctorAvailability,
               DoctorTimeSlot,
               Appointment,
          ]),
     ],
     controllers: [
          DoctorController,
     ],
     providers: [
          DoctorService,
          ScheduleService,
     ],
     exports: [
          DoctorService,
          ScheduleService,
     ],
})
export class DoctorModule { }
