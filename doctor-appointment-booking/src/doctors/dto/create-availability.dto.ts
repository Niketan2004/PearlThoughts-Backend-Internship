import {
     IsNotEmpty,
     IsString,
     IsInt,
     IsOptional,
     IsEnum,
     IsArray,
     IsDateString,
     IsDate,
     Min,
     Max,
     ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Session, Weekday } from '../enums/availability.enums';

export class CreateDoctorAvailabilityDto {
     @IsOptional()
     @IsDate()
     @Type(() => Date)
     date?: Date;

     @IsNotEmpty()
     @IsString()
     consulting_start_time: string;

     @IsNotEmpty()
     @IsString()
     consulting_end_time: string;

     @IsEnum(Session)
     session: Session;

     @IsOptional()
     @IsArray()
     @IsEnum(Weekday, { each: true })
     weekdays?: Weekday[];

     @IsOptional()
     @IsDateString()
     booking_start_at?: string;

     @IsOptional()
     @IsDateString()
     booking_end_at?: string;
}

export class UpdateDoctorAvailabilityDto {
     @IsOptional()
     @IsDate()
     @Type(() => Date)
     date?: Date;

     @IsOptional()
     @IsString()
     consulting_start_time?: string;

     @IsOptional()
     @IsString()
     consulting_end_time?: string;

     @IsOptional()
     @IsEnum(Session)
     session?: Session;

     @IsOptional()
     @IsArray()
     @IsEnum(Weekday, { each: true })
     weekdays?: Weekday[];

     @IsOptional()
     @IsDateString()
     booking_start_at?: string;

     @IsOptional()
     @IsDateString()
     booking_end_at?: string;
}
