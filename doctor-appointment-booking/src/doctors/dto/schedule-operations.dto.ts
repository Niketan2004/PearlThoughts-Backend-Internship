import { IsNotEmpty, IsString, IsInt, Min, IsOptional, IsEnum } from 'class-validator';

export enum SchedulingType {
     SLOT_SLOT = 'slot_slot',
     TIME_SHIFT = 'time_shift',
     SHRINKING = 'shrinking'
}

/**
 * Unified DTO for all rescheduling operations
 * The scheduling_type determines which fields are required/used
 */
export class UnifiedRescheduleDto {
     @IsNotEmpty()
     @IsInt()
     @Min(1)
     availability_id: number;

     @IsNotEmpty()
     @IsEnum(SchedulingType)
     scheduling_type: SchedulingType;

     @IsOptional()
     @IsString()
     reason?: string;

     // For SLOT_SLOT operations
     @IsOptional()
     @IsInt()
     @Min(1)
     source_slot_id?: number;

     @IsOptional()
     @IsInt()
     @Min(1)
     target_slot_id?: number;

     @IsOptional()
     @IsInt()
     @Min(1)
     appointment_id?: number;

     // For TIME_SHIFT and SHRINKING operations
     @IsOptional()
     @IsString()
     new_start_time?: string;

     @IsOptional()
     @IsString()
     new_end_time?: string;

     @IsOptional()
     @IsInt()
     shift_minutes?: number;
}