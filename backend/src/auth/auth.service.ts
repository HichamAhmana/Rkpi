import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(username: string, password: string): Promise<{ access_token: string }> {
    const validUser = this.configService.get<string>('AUTH_USERNAME', 'admin');
    const validPass = this.configService.get<string>('AUTH_PASSWORD', 'admin123');

    if (username !== validUser || password !== validPass) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const payload = { username, sub: 1 };
    return { access_token: this.jwtService.sign(payload) };
  }
}
