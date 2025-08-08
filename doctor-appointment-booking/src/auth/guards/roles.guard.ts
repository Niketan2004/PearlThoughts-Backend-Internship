import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user.enums';

@Injectable()
export class RolesGuard implements CanActivate {
     constructor(private reflector: Reflector) { }

     canActivate(context: ExecutionContext): boolean {
          const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
               context.getHandler(),
               context.getClass(),
          ]);

          if (!requiredRoles) {
               return true;
          }

          const { user } = context.switchToHttp().getRequest();
          const hasRole = requiredRoles.some((role) => user.role === role);

          if (!hasRole) {
               throw new ForbiddenException('Access denied: Insufficient permissions');
          }

          return hasRole;
     }
}
