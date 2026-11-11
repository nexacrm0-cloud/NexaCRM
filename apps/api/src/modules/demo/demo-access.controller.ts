import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { z } from 'zod';
import { DemoAccessService } from './demo-access.service';
import { InternalApiKeyGuard } from '../../common/guards/internal-api-key.guard';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const createDemoAccessSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(1).max(80).optional(),
  contactName: z.string().min(1).max(80).optional(),
});

const demoTokenParamSchema = z.object({
  token: z.string().min(20).max(2000),
});

@Controller('demo')
export class DemoAccessController {
  constructor(private demoAccessService: DemoAccessService) {}

  /**
   * Mints a one-click demo link for a prospect.
   *
   * Guarded by the internal API key: it creates tenants and users, so it is
   * a sales-tool endpoint, NOT something a browser (or a stranger) can call.
   */
  @Post('access')
  @UseGuards(InternalApiKeyGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async createAccess(
    @Body(new ZodPipe(createDemoAccessSchema))
    body: {
      email: string;
      name?: string;
      contactName?: string;
    },
  ) {
    const grant = await this.demoAccessService.createDemoAccess(body);
    return { success: true, data: grant };
  }

  /**
   * Exchanges a demo link token for a regular session.
   *
   * Public on purpose (the prospect opens the link from their e-mail), but
   * the token is the only credential and it expires with the demo window.
   * The refresh token goes into an httpOnly cookie, exactly like a login.
   */
  @Get('session/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async exchange(
    @Param(new ZodPipe(demoTokenParamSchema)) params: { token: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.demoAccessService.exchangeDemoToken(params.token);

    const refreshCookieName =
      process.env.NODE_ENV === 'production' ? '__Host-refresh_token' : 'refresh_token';
    res.cookie(refreshCookieName, session.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      data: { accessToken: session.accessToken, user: session.user },
    };
  }
}
