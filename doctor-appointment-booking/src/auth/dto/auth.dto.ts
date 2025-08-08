import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional, MinLength, IsPhoneNumber } from 'class-validator';
import { UserRole } from '../enums/user.enums';

/**
 * Base User Registration DTO
 * 
 * Contains common fields for user registration.
 * This is extended by role-specific registration DTOs.
 */
export class RegisterDto {
     @IsNotEmpty()
     @IsString()
     full_name: string;                      // User's full name

     @IsEmail()
     email: string;                          // User's email address (unique identifier)

     @IsNotEmpty()
     @IsString()
     @MinLength(6)
     password: string;                       // User's password (minimum 6 characters)

     @IsOptional()
     @IsPhoneNumber('IN')
     phone?: string;                         // User's phone number (Indian format)

     @IsEnum(UserRole)
     role: UserRole;                         // User role (DOCTOR or PATIENT)

     @IsOptional()
     @IsString()
     profile_picture?: string;               // URL to user's profile picture

     @IsOptional()
     date_of_birth?: Date;                   // User's date of birth

     @IsOptional()
     @IsString()
     gender?: string;                        // User's gender
}

/**
 * User Login DTO
 * 
 * Simple login form with email and password
 */
export class LoginDto {
     @IsEmail()
     email: string;                          // User's email address

     @IsNotEmpty()
     @IsString()
     password: string;                       // User's password for authentication
}

/**
 * Doctor Registration DTO
 * 
 * Extends base user registration with doctor-specific fields
 * including medical credentials, specialization, and clinic information
 */
export class DoctorRegistrationDto extends RegisterDto {
     @IsNotEmpty()
     @IsString()
     education: string;                      // Doctor's educational background/degree

     @IsNotEmpty()
     @IsString()
     specialization: string;                 // Medical specialization (e.g., Cardiology, Pediatrics)

     @IsNotEmpty()
     experience_years: number;               // Years of medical experience

     @IsNotEmpty()
     @IsString()
     clinic_name: string;                    // Name of the clinic/hospital

     @IsNotEmpty()
     @IsString()
     clinic_address: string;                 // Complete clinic address with location details

     @IsOptional()
     consultation_fee?: number;              // Fee charged per consultation session

     @IsOptional()
     @IsString()
     about?: string;                         // Doctor's bio/professional description
}

/**
 * Patient Registration DTO
 * 
 * Extends base user registration with patient-specific fields
 * including medical history, emergency contacts, and health information
 */
export class PatientRegistrationDto extends RegisterDto {
     @IsOptional()
     age?: number;                           // Patient's current age

     @IsOptional()
     @IsString()
     address?: string;                       // Patient's home address

     @IsOptional()
     @IsPhoneNumber('IN')
     emergency_contact?: string;             // Emergency contact phone number

     @IsOptional()
     @IsString()
     medical_history?: string;               // Patient's medical history

     @IsOptional()
     @IsString()
     allergies?: string;                     // Known allergies

     @IsOptional()
     @IsString()
     current_medications?: string;           // Current medications being taken
}
