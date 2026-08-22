import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { OtpService } from './otp.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AccountThrottlerGuard } from '../../common/guards/login-throttler.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  loginSchema,
  registerSchema,
  acceptInvitationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  completeOnboardingSchema,
} from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { AuthenticatedUser, RequestWithUser } from '../../common/interfaces/auth.interface';
import { InvitationsService } from '../invitations/invitations.service';
import { NotificationsService } from '../notifications/notifications.service';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly invitationsService: InvitationsService,
    private readonly notificationsService: NotificationsService,
    private readonly otpService: OtpService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async register(
    @Body(new ZodPipe(registerSchema)) body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = body as any;
    const result = await this.authService.register(data);
    this.setRefreshTokenCookie(res, result.refreshToken);
    // SECURITY M-14: send a verification email with a clickable link
    // instead of a generic welcome. The user must confirm email ownership.
    if (result.verificationToken) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      await this.notificationsService
        .sendEmailVerificationEmail(
          result.user.email,
          result.user.firstName,
          `${frontendUrl}/verify-email?token=${result.verificationToken}`,
        )
        .catch(() => undefined);
    }
    await this.sendWelcomeAfterSignup({
      email: result.user.email,
      firstName: result.user.firstName,
      organizationName: result.user.organizationName,
    }).catch(() => undefined);
    return { success: true, data: { user: result.user, accessToken: result.accessToken } };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body('token') token: string) {
    if (!token) throw new Error('Token requerido');
    await this.authService.verifyEmail(token);
    return { success: true, data: { message: 'Email verificado exitosamente' } };
  }

  @Post('send-verification-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  async resendVerification(@Body('email') email: string) {
    if (!email) throw new Error('Email requerido');
    const result = await this.authService.sendVerificationEmail(email);
    if (result.token) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      await this.notificationsService
        .sendEmailVerificationEmail(
          email,
          '', // firstName is unknown (anti-enumeration)
          `${frontendUrl}/verify-email?token=${result.token}`,
        )
        .catch(() => undefined);
    }
    return {
      success: true,
      data: { message: 'Si el email está registrado, recibirás un enlace de verificación' },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccountThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodPipe(loginSchema)) body: unknown,
  ) {
    const data = body as any;
    const result = await this.authService.login(data.email, data.password);
    if ('requiresTwoFactor' in result) {
      // Set a 5-minute signed pending token cookie that ONLY /auth/2fa/complete-login
      // will accept. The SPA still needs to know userId to call complete-login,
      // but now it can only complete by also presenting this cookie.
      const maxAge = 5 * 60 * 1000;
      res.cookie('twofa_pending', result.pendingToken, { ...COOKIE_OPTS, maxAge });
      return { success: true, data: { requiresTwoFactor: true, userId: result.userId } };
    }
    this.setRefreshTokenCookie(res, result.refreshToken);
    await this.sendLoginAlert(
      {
        email: result.user.email,
        firstName: result.user.firstName,
      },
      req.ip,
    ).catch(() => undefined);
    return { success: true, data: { user: result.user, accessToken: result.accessToken } };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName =
      process.env.NODE_ENV === 'production' ? '__Host-refresh_token' : 'refresh_token';
    const refreshToken = req.cookies?.[cookieName];
    const result = await this.authService.refresh(refreshToken);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { success: true, data: { accessToken: result.accessToken } };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.id);
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };
    const refreshName =
      process.env.NODE_ENV === 'production' ? '__Host-refresh_token' : 'refresh_token';
    res.clearCookie(refreshName, { ...cookieOpts, maxAge: 0 });
    res.clearCookie('twofa_pending', { ...COOKIE_OPTS, maxAge: 0 });
    res.clearCookie('access_token', { path: '/', maxAge: 0 });
    res.clearCookie('csrf-token', { path: '/', maxAge: 0 });
    return { success: true, data: { message: 'Sesión cerrada exitosamente' } };
  }

  @Post('accept-invitation')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(@Body(new ZodPipe(acceptInvitationSchema)) body: unknown) {
    const data = body as { token: string; firstName: string; lastName: string; password: string };
    const user = await this.invitationsService.accept(data.token, {
      firstName: data.firstName,
      lastName: data.lastName,
      password: data.password,
    });
    await this.sendWelcomeAfterInvite({
      email: user.email,
      firstName: user.firstName,
      organizationName: user.organization?.name,
    }).catch(() => undefined);
    return { success: true, data: { message: 'Invitaci��n aceptada exitosamente', user } };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.authService.getProfile(user.id);
    return { success: true, data: profile };
  }

  @Get('onboarding-status')
  @UseGuards(JwtAuthGuard)
  async getOnboardingStatus(@Req() req: RequestWithUser) {
    const result = await this.authService.checkOnboardingStatus(
      req.user.id,
      req.user.organizationId,
    );
    return { success: true, data: result };
  }

  @Post('complete-onboarding')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(completeOnboardingSchema))
    body: { currency: 'USD' | 'ARS' | 'MXN' | 'COP' | 'CLP' | 'EUR' | 'BRL' | 'PEN' | 'UYU' },
  ) {
    await this.authService.completeOnboarding(user.organizationId, body.currency);
    return { success: true, data: { message: 'Onboarding completado' } };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async forgotPassword(@Body(new ZodPipe(forgotPasswordSchema)) body: unknown) {
    const data = body as { email: string };
    const result = await this.authService.forgotPassword(data.email);

    if (result.token) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetLink = `${frontendUrl}/reset-password?token=${result.token}`;
      await this.notificationsService.sendPasswordResetEmail(data.email, resetLink);
    }

    return { success: true, data: { message: result.message } };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async resetPassword(@Body(new ZodPipe(resetPasswordSchema)) body: unknown) {
    const data = body as { token: string; password: string };
    await this.authService.resetPassword(data.token, data.password);
    return { success: true, data: { message: 'Contraseña restablecida exitosamente' } };
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  async setupTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.twoFactorService.generateSecret(user.id, user.email);
    return { success: true, data: result };
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  async verifyTwoFactor(@CurrentUser() user: AuthenticatedUser, @Body('token') token: string) {
    const result = await this.twoFactorService.verifyAndEnable(user.id, token);
    return { success: true, data: result };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disableTwoFactor(@CurrentUser() user: AuthenticatedUser, @Body('token') token: string) {
    const result = await this.twoFactorService.disable(user.id, token);
    return { success: true, data: result };
  }

  @Post('2fa/complete-login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccountThrottlerGuard)
  // tighter: 5 attempts per minute per (IP, email-or-userId) to reduce
  // brute-force surface even further now that the attacker also needs the
  // signed pending cookie.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async completeTwoFactorLogin(
    @Req() req: Request,
    @Body('userId') userId: string,
    @Body('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pendingToken = (req as any).cookies?.['twofa_pending'] as string | undefined;
    const result = await this.authService.completeTwoFactorLogin(userId, token, pendingToken);
    res.clearCookie('twofa_pending', { ...COOKIE_OPTS, maxAge: 0 });
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { success: true, data: { user: result.user, accessToken: result.accessToken } };
  }

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async requestOtp(@Body('email') email: string, @Body('purpose') purpose?: 'login' | 'reset') {
    if (purpose && !['login', 'reset'].includes(purpose)) {
      return { success: false, data: { message: 'purpose inválido' } };
    }
    const result = await this.otpService.requestOtp(email ?? '', purpose ?? 'login');
    return {
      success: true,
      data: { ok: result.ok, cooldownMs: result.cooldownMs ?? null },
    };
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyOtp(
    @Body('email') email: string,
    @Body('code') code: string,
    @Body('purpose') purpose: 'login' | 'reset',
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!['login', 'reset'].includes(purpose)) {
      return { success: false, data: { message: 'purpose inválido' } };
    }
    if (purpose === 'reset') {
      const verified = await this.otpService.verifyOtp(email, code, 'reset');
      if (!verified.user) {
        return { success: false, data: { message: 'Código inválido' } };
      }
      return {
        success: true,
        data: { verified: true, userId: verified.user.id, email: verified.user.email },
      };
    }

    const verified = await this.otpService.verifyOtp(email, code, 'login');
    if (!verified.user) {
      return { success: false, data: { message: 'Código inválido' } };
    }
    const result = await this.authService.loginFromOtp({
      id: verified.user.id,
      email: verified.user.email,
      firstName: verified.user.firstName,
      lastName: verified.user.lastName,
      role: verified.user.role,
      organizationId: verified.user.organizationId,
      organization: {
        name: verified.user.organization?.name ?? 'Workspace',
        plan: (verified.user.organization as any)?.plan ?? 'free',
      },
    });
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { success: true, data: { user: result.user, accessToken: result.accessToken } };
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    // SECURITY M-15/H2: use the __Host- prefix so that, in production, the
    // cookie can only be set/cleared over HTTPS from the same host (no
    // subdomain spoofing, no path override). In dev (http), we fall back to a
    // plain name so the browser actually stores the cookie.
    // SECURITY D4: maxAge dropped from 7d → 24h to match the JWT exp claim
    // (set in AuthService.generateTokens). The browser discards the cookie
    // when maxAge elapses, mirroring the server-side expiry.
    const name = process.env.NODE_ENV === 'production' ? '__Host-refresh_token' : 'refresh_token';
    res.cookie(name, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  private async sendWelcomeAfterSignup(user: {
    email: string;
    firstName: string;
    organizationName?: string;
  }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    await this.notificationsService.sendWelcomeEmail({
      to: user.email,
      firstName: user.firstName,
      organizationName: user.organizationName ?? 'tu nuevo workspace',
      loginUrl: `${frontendUrl}/login`,
      isInvitation: false,
    });
  }

  private async sendWelcomeAfterInvite(user: {
    email: string;
    firstName: string;
    organizationName?: string;
  }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    await this.notificationsService.sendWelcomeEmail({
      to: user.email,
      firstName: user.firstName,
      organizationName: user.organizationName ?? 'tu equipo',
      loginUrl: `${frontendUrl}/login`,
      isInvitation: true,
    });
  }

  private async sendLoginAlert(user: { email: string; firstName: string }, ip?: string) {
    await this.notificationsService.sendNewLoginEmail({
      to: user.email,
      firstName: user.firstName,
      at: new Date(),
      ip,
    });
  }
}
