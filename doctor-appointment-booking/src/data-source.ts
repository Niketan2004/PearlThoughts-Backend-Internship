import { DataSource } from 'typeorm';
import { User } from './auth/entities/user.entity';
import { Doctor } from './doctors/entities/doctor.entity';
import { Patient } from './patients/entities/patient.entity';
import { DoctorAvailability } from './doctors/entities/doctor-availability.entity';
import { DoctorTimeSlot } from './doctors/entities/doctor-time-slot.entity';
import { Appointment } from './appointments/entities/appointment.entity';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

// TypeORM DataSource Configuration for Schedula appointment booking system
const AppDataSource = new DataSource({
     type: 'postgres',
     host: process.env.DB_HOST,
     port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
     username: process.env.DB_PGUSERNAME || 'postgres',
     password: process.env.DB_PGPASSWORD,
     database: process.env.DB_DATABASE,

     // All system entities
     entities: [
          User, // Base user entity for authentication
          Doctor, // Doctor profile with medical credentials
          Patient, // Patient profile with medical history
          DoctorAvailability, // Doctor availability windows
          DoctorTimeSlot, // Individual bookable time slots
          Appointment // Appointment records and status
     ],

     // Migration settings
     migrations: [path.join(__dirname, '/migrations/*.{ts,js}')],
     synchronize: false, // Use migrations instead of auto-sync
     migrationsRun: false, // Don't auto-run migrations

     // Logging
     logging: ['error', 'warn'],
     logger: 'advanced-console',

     // Connection settings
     ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
     connectTimeoutMS: 60000,

     // PostgreSQL connection pool
     extra: {
          connectionLimit: 10
     },
});

export default AppDataSource;