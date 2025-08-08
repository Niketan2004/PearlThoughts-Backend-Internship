import {
     ArrayNotEmpty,
     ArrayUnique,
     IsArray,
     IsEnum,
     IsNotEmpty,
     IsNumber,
     IsOptional,
     IsString,
     Max,
     Min,
} from 'class-validator';
import { RescheduleType } from '../enums/reschedule-type.enum';

export class RescheduleAppointmentDto {
     @IsOptional()
     @IsNumber()
     @Min(10)
     @Max(180)
     shift_minutes?: number;

     @IsOptional()
     @IsEnum(RescheduleType)
     reschedule_type?: RescheduleType;

     @IsOptional()
     @IsArray()
     @ArrayNotEmpty()
     @ArrayUnique()
     @IsNumber({}, { each: true })
     appointment_ids?: number[];

     // New fields for proper slot-to-slot rescheduling
     @IsOptional()
     @IsNumber()
     new_timeslot_id?: number;

     @IsOptional()
     @IsString()
     reason?: string;

     @IsOptional()
     @IsNumber()
     appointment_id?: number;
}
