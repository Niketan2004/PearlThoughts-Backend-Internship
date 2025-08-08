import {
     Controller,
     Post,
     Body,
     HttpCode,
     HttpStatus,
     UseGuards,
     Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, DoctorRegistrationDto, PatientRegistrationDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';

/**
 * Authentication Controller
 * 
 * Handles all authentication-related endpoints including:
 * - Patient registration
 * - Doctor registration
 * - User login
 * - User logout
 * 
 * Uses JWT (JSON Web Tokens) for stateless authentication
 */
@Controller('api/auth')
export class AuthController {
     constructor(private readonly authService: AuthService) { }

     /**
      * Register a new patient account
      * 
      * @param patientRegDto - Patient registration data transfer object
      * @returns Success message and user profile information
      */
     @Post('patient/register')
     @HttpCode(HttpStatus.CREATED)
     async registerPatient(@Body() patientRegDto: PatientRegistrationDto) {
          // Call auth service to create patient account
          return this.authService.registerPatient(patientRegDto);
     }

     /**
      * Register a new doctor account
      * 
      * @param doctorRegDto - Doctor registration data transfer object
      * @returns Success message and user profile information
      */
     @Post('doctor/register')
     @HttpCode(HttpStatus.CREATED)
     async registerDoctor(@Body() doctorRegDto: DoctorRegistrationDto) {
          // Call auth service to create doctor account
          return this.authService.registerDoctor(doctorRegDto);
     }

     /**
      * Login endpoint for both doctors and patients
      * 
      * @param loginDto - Login credentials (email and password)
      * @returns JWT token and user information upon successful authentication
      */
     @Post('login')
     @HttpCode(HttpStatus.OK)
     async login(@Body() loginDto: LoginDto) {
          // Authenticate user and return JWT token
          return this.authService.login(loginDto);
     }

     /**
      * Logout endpoint
      * 
      * Note: In a stateless JWT system, logout is primarily handled client-side
      * by removing the token. This endpoint provides a standardized logout response.
      * Token blacklisting can be implemented here if needed for additional security.
      * 
      * @param req - Request object containing user information
      * @returns Success message confirming logout
      */
     @Post('logout')
     @UseGuards(JwtAuthGuard)
     @HttpCode(HttpStatus.OK)
     async logout(@Req() req: Request) {
          // Return logout confirmation (token removal handled client-side)
          return {
               success: true,
               message: 'Logged out successfully',
          };
     }
}
