import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Application Controller
 * 
 * Handles root-level endpoints for API health checks and status
 */
@Controller()
export class AppController {
     constructor(private readonly appService: AppService) { }

     // Root endpoint - API health check
     @Get()
     getHello(): string {
          return this.appService.getHello();
     }
}
