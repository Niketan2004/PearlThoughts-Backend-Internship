import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { User } from '../src/auth/entities/user.entity';
import { Doctor } from '../src/doctors/entities/doctor.entity';
import { Patient } from '../src/patients/entities/patient.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('Appointment Booking System (e2e)', () => {
     let app: INestApplication;
     let userRepository: Repository<User>;
     let doctorRepository: Repository<Doctor>;
     let patientRepository: Repository<Patient>;

     beforeEach(async () => {
          const moduleFixture: TestingModule = await Test.createTestingModule({
               imports: [AppModule],
          }).compile();

          app = moduleFixture.createNestApplication();
          userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
          doctorRepository = moduleFixture.get<Repository<Doctor>>(getRepositoryToken(Doctor));
          patientRepository = moduleFixture.get<Repository<Patient>>(getRepositoryToken(Patient));

          await app.init();
     });

     afterEach(async () => {
          await app.close();
     });

     describe('Authentication', () => {
          it('/auth/register (POST) - should register a new doctor', () => {
               return request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                         email: 'doctor@test.com',
                         password: 'password123',
                         firstName: 'John',
                         lastName: 'Doe',
                         role: 'DOCTOR',
                         phoneNumber: '+1234567890',
                         specialization: 'Cardiology',
                         qualifications: 'MD, FACC',
                         experience: 10,
                         consultationFee: 150.00,
                    })
                    .expect(201)
                    .expect((res) => {
                         expect(res.body.success).toBe(true);
                         expect(res.body.data.user.email).toBe('doctor@test.com');
                         expect(res.body.data.user.role).toBe('DOCTOR');
                    });
          });

          it('/auth/register (POST) - should register a new patient', () => {
               return request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                         email: 'patient@test.com',
                         password: 'password123',
                         firstName: 'Jane',
                         lastName: 'Smith',
                         role: 'PATIENT',
                         phoneNumber: '+0987654321',
                         dateOfBirth: '1990-01-01',
                         gender: 'FEMALE',
                         address: '123 Main St',
                         emergencyContact: '+1122334455',
                    })
                    .expect(201)
                    .expect((res) => {
                         expect(res.body.success).toBe(true);
                         expect(res.body.data.user.email).toBe('patient@test.com');
                         expect(res.body.data.user.role).toBe('PATIENT');
                    });
          });

          it('/auth/login (POST) - should login with valid credentials', () => {
               return request(app.getHttpServer())
                    .post('/auth/login')
                    .send({
                         email: 'doctor@test.com',
                         password: 'password123',
                    })
                    .expect(200)
                    .expect((res) => {
                         expect(res.body.success).toBe(true);
                         expect(res.body.data.access_token).toBeDefined();
                         expect(res.body.data.user.email).toBe('doctor@test.com');
                    });
          });
     });

     describe('Doctor Management', () => {
          let doctorToken: string;
          let doctorId: string;

          beforeEach(async () => {
               // Register and login as doctor
               await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                         email: 'doctor2@test.com',
                         password: 'password123',
                         firstName: 'Sarah',
                         lastName: 'Wilson',
                         role: 'DOCTOR',
                         phoneNumber: '+1111111111',
                         specialization: 'Dermatology',
                         qualifications: 'MD, PhD',
                         experience: 8,
                         consultationFee: 120.00,
                    });

               const loginResponse = await request(app.getHttpServer())
                    .post('/auth/login')
                    .send({
                         email: 'doctor2@test.com',
                         password: 'password123',
                    });

               doctorToken = loginResponse.body.data.access_token;
               doctorId = loginResponse.body.data.user.doctor.id;
          });

          it('/doctors (GET) - should get all doctors', () => {
               return request(app.getHttpServer())
                    .get('/doctors')
                    .expect(200)
                    .expect((res) => {
                         expect(res.body.success).toBe(true);
                         expect(Array.isArray(res.body.data)).toBe(true);
                    });
          });

          it('/doctors/:id/availability (POST) - should set doctor availability', () => {
               return request(app.getHttpServer())
                    .post(`/doctors/${doctorId}/availability`)
                    .set('Authorization', `Bearer ${doctorToken}`)
                    .send({
                         dayOfWeek: 'MONDAY',
                         startTime: '09:00',
                         endTime: '17:00',
                         isAvailable: true,
                    })
                    .expect(201)
                    .expect((res) => {
                         expect(res.body.success).toBe(true);
                    });
          });

          it('/doctors/:id/timeslots (POST) - should create time slots', () => {
               return request(app.getHttpServer())
                    .post(`/doctors/${doctorId}/timeslots`)
                    .set('Authorization', `Bearer ${doctorToken}`)
                    .send({
                         date: '2024-01-15',
                         startTime: '09:00',
                         endTime: '09:30',
                         isAvailable: true,
                    })
                    .expect(201)
                    .expect((res) => {
                         expect(res.body.success).toBe(true);
                    });
          });
     });

     describe('Appointment Booking Flow', () => {
          let patientToken: string;
          let doctorToken: string;
          let patientId: string;
          let doctorId: string;
          let timeSlotId: string;

          beforeEach(async () => {
               // Register doctor
               await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                         email: 'bookingdoctor@test.com',
                         password: 'password123',
                         firstName: 'Michael',
                         lastName: 'Johnson',
                         role: 'DOCTOR',
                         phoneNumber: '+2222222222',
                         specialization: 'General Medicine',
                         qualifications: 'MD',
                         experience: 5,
                         consultationFee: 100.00,
                    });

               // Register patient
               await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                         email: 'bookingpatient@test.com',
                         password: 'password123',
                         firstName: 'Emma',
                         lastName: 'Brown',
                         role: 'PATIENT',
                         phoneNumber: '+3333333333',
                         dateOfBirth: '1985-05-15',
                         gender: 'FEMALE',
                         address: '456 Oak St',
                    });

               // Login as doctor
               const doctorLogin = await request(app.getHttpServer())
                    .post('/auth/login')
                    .send({
                         email: 'bookingdoctor@test.com',
                         password: 'password123',
                    });

               // Login as patient
               const patientLogin = await request(app.getHttpServer())
                    .post('/auth/login')
                    .send({
                         email: 'bookingpatient@test.com',
                         password: 'password123',
                    });

               doctorToken = doctorLogin.body.data.access_token;
               patientToken = patientLogin.body.data.access_token;
               doctorId = doctorLogin.body.data.user.doctor.id;
               patientId = patientLogin.body.data.user.patient.id;

               // Create time slot
               const timeSlotResponse = await request(app.getHttpServer())
                    .post(`/doctors/${doctorId}/timeslots`)
                    .set('Authorization', `Bearer ${doctorToken}`)
                    .send({
                         date: '2024-01-15',
                         startTime: '10:00',
                         endTime: '10:30',
                         isAvailable: true,
                    });

               timeSlotId = timeSlotResponse.body.data.id;
          });

          it('should complete the full appointment booking flow', async () => {
               // Book appointment
               const bookingResponse = await request(app.getHttpServer())
                    .post('/appointments')
                    .set('Authorization', `Bearer ${patientToken}`)
                    .send({
                         doctorId: doctorId,
                         timeSlotId: timeSlotId,
                         appointmentDate: '2024-01-15',
                         appointmentTime: '10:00',
                         reasonForVisit: 'Regular checkup',
                         symptoms: 'General wellness check',
                    })
                    .expect(201);

               expect(bookingResponse.body.success).toBe(true);
               const appointmentId = bookingResponse.body.data.id;

               // Get appointment details
               await request(app.getHttpServer())
                    .get(`/appointments/${appointmentId}`)
                    .set('Authorization', `Bearer ${patientToken}`)
                    .expect(200)
                    .expect((res) => {
                         expect(res.body.success).toBe(true);
                         expect(res.body.data.status).toBe('SCHEDULED');
                    });

               // Cancel appointment
               await request(app.getHttpServer())
                    .put(`/appointments/${appointmentId}/cancel`)
                    .set('Authorization', `Bearer ${patientToken}`)
                    .send({
                         cancellationReason: 'Personal emergency',
                    })
                    .expect(200)
                    .expect((res) => {
                         expect(res.body.success).toBe(true);
                         expect(res.body.data.status).toBe('CANCELLED');
                    });
          });
     });
});
