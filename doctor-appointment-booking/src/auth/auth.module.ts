import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { Patient } from '../patients/entities/patient.entity';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
     imports: [
          TypeOrmModule.forFeature([User, Doctor, Patient]),
          JwtModule.registerAsync({
               imports: [ConfigModule],
               useFactory: async (configService: ConfigService) => ({
                    secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
                    signOptions: {
                         expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '24h',
                    },
               }),
               inject: [ConfigService],
          }),
     ],
     controllers: [AuthController],
     providers: [AuthService, JwtStrategy],
     exports: [AuthService],
})
export class AuthModule { }
