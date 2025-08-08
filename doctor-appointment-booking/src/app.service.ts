import { Injectable } from '@nestjs/common';

/**
 * Application Service
 * 
 * Provides basic application health and status endpoints
 */
@Injectable()
export class AppService {
     // Return API status message
     getHello(): string {
          return 'Hello World! Doctor Appointment Booking System API is running!';
     }
}
