import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DoctorModule } from './doctors/doctor.module';
import { PatientModule } from './patients/patient.module';
import { AppointmentModule } from './appointments/appointment.module';
import { User } from './auth/entities/user.entity';
import { Doctor } from './doctors/entities/doctor.entity';
import { Patient } from './patients/entities/patient.entity';
import { DoctorAvailability } from './doctors/entities/doctor-availability.entity';
import { DoctorTimeSlot } from './doctors/entities/doctor-time-slot.entity';
import { Appointment } from './appointments/entities/appointment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST') || 'localhost',
        port: parseInt(configService.get('DB_PORT') || '5432'),
        username: configService.get('DB_PGUSERNAME') || 'postgres',
        password: configService.get('DB_PGPASSWORD') || 'root',
        database: configService.get('DB_DATABASE') || 'schedula_db',
        entities: [User, Doctor, Patient, DoctorAvailability, DoctorTimeSlot, Appointment],
        synchronize: false,
        logging: false,
        retryAttempts: 3,
        retryDelay: 3000,
        autoLoadEntities: true,
        ssl: false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    DoctorModule,
    PatientModule,
    AppointmentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
