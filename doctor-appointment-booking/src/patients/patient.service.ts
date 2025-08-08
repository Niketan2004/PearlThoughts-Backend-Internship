import {
     Injectable,
     NotFoundException,
     InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientService {
     constructor(
          @InjectRepository(Patient)
          private patientRepository: Repository<Patient>,
     ) { }

     async getProfile(patientId: number) {
          try {
               const patient = await this.patientRepository.findOne({
                    where: { user_id: patientId },
                    relations: ['user'],
               });

               if (!patient) {
                    throw new NotFoundException('Patient not found');
               }

               return {
                    message: 'Patient profile retrieved successfully',
                    data: {
                         ...patient,
                         user: patient.user.profile,
                    },
               };
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error retrieving patient profile');
          }
     }

     async updateProfile(patientId: number, updateData: Partial<Patient>) {
          try {
               const patient = await this.patientRepository.findOne({
                    where: { user_id: patientId },
               });

               if (!patient) {
                    throw new NotFoundException('Patient not found');
               }

               // Update only provided fields
               Object.assign(patient, updateData);
               const updatedPatient = await this.patientRepository.save(patient);

               return {
                    message: 'Patient profile updated successfully',
                    data: updatedPatient,
               };
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error updating patient profile');
          }
     }

     async getPatientByUserId(userId: number) {
          try {
               const patient = await this.patientRepository.findOne({
                    where: { user_id: userId },
                    relations: ['user'],
               });

               if (!patient) {
                    throw new NotFoundException('Patient not found');
               }

               return patient;
          } catch (error) {
               if (error instanceof NotFoundException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error retrieving patient');
          }
     }

     async getPatientProfile(patientId: number) {
          return this.getProfile(patientId);
     }

     async updatePatientProfile(patientId: number, updateData: UpdatePatientDto) {
          return this.updateProfile(patientId, updateData);
     }
}
