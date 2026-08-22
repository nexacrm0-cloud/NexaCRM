import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { OtpService } from './otp.service';
import { CaptchaService } from './captcha.service';
import { LoginAttemptService } from './login-attempt.service';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { InvitationsModule } from '../invitations/invitations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    InvitationsModule,
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TwoFactorService,
    OtpService,
    CaptchaService,
    LoginAttemptService,
    JwtStrategy,
  ],
  exports: [
    AuthService,
    TwoFactorService,
    OtpService,
    CaptchaService,
    LoginAttemptService,
    JwtModule,
  ],
})
export class AuthModule {}
