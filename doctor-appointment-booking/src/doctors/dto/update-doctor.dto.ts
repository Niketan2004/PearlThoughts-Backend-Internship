import { IsOptional, IsString, IsNumber, IsPhoneNumber, Min } from 'class-validator';

export class UpdateDoctorDto {
     @IsOptional()
     @IsString()
     full_name?: string;

     @IsOptional()
     @IsPhoneNumber('IN')
     phone?: string;

     @IsOptional()
     @IsString()
     profile_picture?: string;

     @IsOptional()
     date_of_birth?: Date;

     @IsOptional()
     @IsString()
     gender?: string;

     @IsOptional()
     @IsString()
     education?: string;

     @IsOptional()
     @IsString()
     specialization?: string;

     @IsOptional()
     @IsNumber()
     @Min(0)
     experience_years?: number;

     @IsOptional()
     @IsString()
     clinic_name?: string;

     @IsOptional()
     @IsString()
     clinic_address?: string;

     @IsOptional()
     @IsNumber()
     @Min(0)
     consultation_fee?: number;

     @IsOptional()
     @IsString()
     about?: string;
}
