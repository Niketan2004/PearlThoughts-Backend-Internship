import {
     IsNotEmpty,
     IsString,
     IsInt,
     Min,
     Max,
} from 'class-validator';

export class CreateTimeslotDto {
     @IsNotEmpty()
     @IsInt()
     availability_id: number;

     @IsNotEmpty()
     @IsString()
     start_time: string;

     @IsNotEmpty()
     @IsString()
     end_time: string;

     @IsNotEmpty()
     @IsInt()
     @Min(1)
     @Max(50)
     max_patients: number;
}

export class UpdateTimeslotDto {
     @IsNotEmpty()
     @IsString()
     start_time?: string;

     @IsNotEmpty()
     @IsString()
     end_time?: string;

     @IsNotEmpty()
     @IsInt()
     @Min(1)
     @Max(50)
     max_patients?: number;
}
