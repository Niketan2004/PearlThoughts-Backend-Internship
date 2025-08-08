import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
     sub: number;
     email: string;
     role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
     constructor(
          @InjectRepository(User)
          private userRepository: Repository<User>,
          private configService: ConfigService,
     ) {
          super({
               jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
               ignoreExpiration: false,
               secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
          });
     }

     async validate(payload: JwtPayload): Promise<JwtPayload> {
          const user = await this.userRepository.findOne({
               where: { user_id: payload.sub },
          });

          if (!user) {
               throw new UnauthorizedException('User not found');
          }

          return {
               sub: user.user_id,
               email: user.email,
               role: user.role,
          };
     }
}
