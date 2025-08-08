import { Module } from '@nestjs/common';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from './entities/patient.entity';

@Module({
     imports: [TypeOrmModule.forFeature([Patient])],
     controllers: [PatientController],
     providers: [PatientService],
     exports: [PatientService],
})
export class PatientModule { }
