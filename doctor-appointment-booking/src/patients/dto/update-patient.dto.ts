import { IsOptional, IsString, IsNumber, IsPhoneNumber, Min, Max } from 'class-validator';

export class UpdatePatientDto {
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
     @IsNumber()
     @Min(1)
     @Max(120)
     age?: number;

     @IsOptional()
     @IsString()
     address?: string;

     @IsOptional()
     @IsPhoneNumber('IN')
     emergency_contact?: string;

     @IsOptional()
     @IsString()
     medical_history?: string;

     @IsOptional()
     @IsString()
     allergies?: string;

     @IsOptional()
     @IsString()
     current_medications?: string;
}
