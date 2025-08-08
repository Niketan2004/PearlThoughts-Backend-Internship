import {
     Injectable,
     ConflictException,
     UnauthorizedException,
     BadRequestException,
     InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { Patient } from '../patients/entities/patient.entity';
import { RegisterDto, LoginDto, DoctorRegistrationDto, PatientRegistrationDto } from './dto/auth.dto';
import { UserRole } from './enums/user.enums';

/**
 * JWT Payload Interface
 * 
 * Defines the structure of the JWT token payload used for authentication
 */
export interface JwtPayload {
     sub: number;        // Subject (user ID)
     email: string;      // User email address
     role: UserRole;     // User role (DOCTOR or PATIENT)
}

/**
 * Authentication Service
 * 
 * Handles all authentication-related business logic including:
 * - User registration (doctors and patients)
 * - User login and JWT token generation
 * - Password hashing and verification
 * - JWT token validation
 * 
 * Uses bcrypt for password hashing and JWT for stateless authentication
 */
@Injectable()
export class AuthService {
     constructor(
          @InjectRepository(User)
          private userRepository: Repository<User>,
          @InjectRepository(Doctor)
          private doctorRepository: Repository<Doctor>,
          @InjectRepository(Patient)
          private patientRepository: Repository<Patient>,
          private jwtService: JwtService,
     ) { }

     /**
      * Generic user registration method
      * 
      * Note: This method is deprecated in favor of role-specific registration methods
      * (registerDoctor and registerPatient) for better validation and profile creation
      * 
      * @param registerDto - Basic user registration data
      * @returns Success message and user profile
      */
     async register(registerDto: RegisterDto) {
          try {
               // Extract user data from registration DTO
               const { email, password, role, ...userData } = registerDto;

               // Check if user already exists with this email
               const existingUser = await this.userRepository.findOne({
                    where: { email },
               });

               if (existingUser) {
                    throw new ConflictException('User with this email already exists');
               }

               // Hash password using bcrypt with salt rounds of 10
               const hashedPassword = await bcrypt.hash(password, 10);

               // Create new user entity with hashed password
               const user = this.userRepository.create({
                    ...userData,
                    email,
                    password: hashedPassword,
                    role,
               });

               // Save user to database
               const savedUser = await this.userRepository.save(user);

               // Create role-specific profile based on user type
               if (role === UserRole.DOCTOR) {
                    // Doctor profile creation is handled by dedicated doctor registration endpoint
                    return {
                         message: 'User registered successfully. Please complete doctor profile.',
                         user: savedUser.profile,
                    };
               } else if (role === UserRole.PATIENT) {
                    // Create basic patient profile linked to user
                    const patient = this.patientRepository.create({
                         user_id: savedUser.user_id,
                    });
                    await this.patientRepository.save(patient);
               }

               return {
                    message: 'User registered successfully',
                    user: savedUser.profile,
               };
          } catch (error) {
               // Re-throw known exceptions, wrap unknown ones
               if (error instanceof ConflictException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error creating user');
          }
     }

     /**
      * Register a new doctor with complete profile information
      * 
      * Creates both User and Doctor entities with all required professional information
      * 
      * @param doctorRegDto - Complete doctor registration data including medical credentials
      * @returns Success message and user profile
      * @throws ConflictException if email already exists
      * @throws InternalServerErrorException for database errors
      */
     async registerDoctor(doctorRegDto: DoctorRegistrationDto) {
          try {
               // Extract all doctor registration data
               const { email, password, role, education, specialization, experience_years, clinic_name, clinic_address, consultation_fee, about, ...userData } = doctorRegDto;

               // Check if user already exists with this email
               const existingUser = await this.userRepository.findOne({
                    where: { email },
               });

               if (existingUser) {
                    throw new ConflictException('User with this email already exists');
               }

               // Hash password using bcrypt with salt rounds of 10
               const hashedPassword = await bcrypt.hash(password, 10);

               // Create user entity with DOCTOR role
               const user = this.userRepository.create({
                    ...userData,
                    email,
                    password: hashedPassword,
                    role: UserRole.DOCTOR,
               });

               // Save user to database first
               const savedUser = await this.userRepository.save(user);

               // Create complete doctor profile with all medical information
               const doctor = this.doctorRepository.create({
                    user_id: savedUser.user_id,
                    education,
                    specialization,
                    experience_years,
                    clinic_name,
                    clinic_address,
                    consultation_fee,
                    about,
               });

               // Save doctor profile to database
               await this.doctorRepository.save(doctor);

               return {
                    message: 'Doctor registered successfully',
                    user: savedUser.profile,
               };
          } catch (error) {
               // Re-throw known exceptions, wrap unknown ones
               if (error instanceof ConflictException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error creating doctor');
          }
     }

     /**
      * Register a new patient with complete profile information
      * 
      * Creates both User and Patient entities with medical history and personal details
      * 
      * @param patientRegDto - Complete patient registration data including medical information
      * @returns Success message and user profile
      * @throws ConflictException if email already exists
      * @throws InternalServerErrorException for database errors
      */
     async registerPatient(patientRegDto: PatientRegistrationDto) {
          try {
               // Extract all patient registration data
               const { email, password, role, age, address, emergency_contact, medical_history, allergies, current_medications, ...userData } = patientRegDto;

               // Check if user already exists with this email
               const existingUser = await this.userRepository.findOne({
                    where: { email },
               });

               if (existingUser) {
                    throw new ConflictException('User with this email already exists');
               }

               // Hash password using bcrypt with salt rounds of 10
               const hashedPassword = await bcrypt.hash(password, 10);

               // Create user entity with PATIENT role
               const user = this.userRepository.create({
                    ...userData,
                    email,
                    password: hashedPassword,
                    role: UserRole.PATIENT,
               });

               // Save user to database first
               const savedUser = await this.userRepository.save(user);

               // Create complete patient profile with medical information
               const patient = this.patientRepository.create({
                    user_id: savedUser.user_id,
                    age,
                    address,
                    emergency_contact,
                    medical_history,
                    allergies,
                    current_medications,
               });

               // Save patient profile to database
               await this.patientRepository.save(patient);

               return {
                    message: 'Patient registered successfully',
                    user: savedUser.profile,
               };
          } catch (error) {
               // Re-throw known exceptions, wrap unknown ones
               if (error instanceof ConflictException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error creating patient');
          }
     }

     /**
      * Authenticate user and generate JWT token
      * 
      * Validates user credentials and returns a JWT token for subsequent API requests
      * 
      * @param loginDto - User login credentials (email and password)
      * @returns JWT access token and user information
      * @throws UnauthorizedException for invalid credentials
      * @throws InternalServerErrorException for server errors
      */
     async login(loginDto: LoginDto) {
          try {
               // Extract login credentials
               const { email, password } = loginDto;

               // Find user by email with related profiles loaded
               const user = await this.userRepository.findOne({
                    where: { email },
                    relations: ['doctor', 'patient'],
               });

               // Check if user exists
               if (!user) {
                    throw new UnauthorizedException('Invalid credentials');
               }

               // Verify password against stored hash
               const isPasswordValid = await bcrypt.compare(password, user.password);

               if (!isPasswordValid) {
                    throw new UnauthorizedException('Invalid credentials');
               }

               // Create JWT payload with user information
               const payload: JwtPayload = {
                    sub: user.user_id,
                    email: user.email,
                    role: user.role,
               };

               // Generate signed JWT token
               const access_token = this.jwtService.sign(payload);

               // Return successful login response with token and user data
               return {
                    message: 'Login successful',
                    access_token,
                    user: {
                         ...user.profile,
                         role: user.role,
                    },
               };
          } catch (error) {
               // Re-throw known exceptions, wrap unknown ones
               if (error instanceof UnauthorizedException) {
                    throw error;
               }
               throw new InternalServerErrorException('Error during login');
          }
     }

     /**
      * Validate JWT payload for authentication
      * 
      * @param payload - JWT payload containing user information
      * @returns User information if valid, throws UnauthorizedException if not
      */
     async validateUser(payload: JwtPayload): Promise<any> {
          // Find user by ID from JWT payload
          const user = await this.userRepository.findOne({
               where: { user_id: payload.sub },
          });

          // Check if user still exists in database
          if (!user) {
               throw new UnauthorizedException('User not found');
          }

          // Return user data for request context
          return {
               sub: user.user_id,
               email: user.email,
               role: user.role,
          };
     }
}
