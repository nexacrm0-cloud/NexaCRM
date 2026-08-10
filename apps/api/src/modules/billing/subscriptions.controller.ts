import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  Header,
  Res,
  RawBodyRequest,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@nexa/database';
import { SubscriptionsService } from './subscriptions.service';
import { InternalApiKeyGuard } from '../../common/guards/internal-api-key.guard';
import { Request, Response } from 'express';
import Stripe from 'stripe';

const cancelSchema = z.object({ templateSlug: z.string().min(1) });

const manualPaySchema = z.object({ id: z.string().min(1) });

@Controller('automation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('my/subscriptions')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MEMBER)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async listMine(@CurrentUser() user: User) {
    return this.subscriptionsService.listForCustomer(user.organizationId);
  }

  @Post('my/subscriptions/start-checkout')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async startCheckout(
    @CurrentUser() user: User,
    @Body('templateSlug') templateSlug: string,
    @Req() req: Request,
  ) {
    if (!templateSlug) throw new BadRequestException('templateSlug requerido');
    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.headers.host}`;
    return this.subscriptionsService.startPaidCheckout(
      user.organizationId,
      user.id,
      templateSlug,
      frontendUrl,
    );
  }

  @Post('my/subscriptions/cancel')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async cancel(@CurrentUser() user: User, @Body(new ZodPipe(cancelSchema)) body: unknown) {
    const data = body as { templateSlug: string };
    return this.subscriptionsService.cancel(user.organizationId, data.templateSlug);
  }
}

@Controller('automation/webhooks')
@UseGuards(InternalApiKeyGuard)
@Throttle({ default: { limit: 300, ttl: 60_000 } })
export class SubscriptionsWebhookController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Post('payments')
  async handle(@Body() payload: unknown, @Req() req: Request) {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) headers[k.toLowerCase()] = String(v[0] ?? '');
      else if (typeof v === 'string') headers[k.toLowerCase()] = v;
    }
    return this.subscriptionsService.handleWebhook(payload, headers);
  }
}

@Controller('automation/webhooks/stripe')
@Throttle({ default: { limit: 300, ttl: 60_000 } })
export class StripeWebhookController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Post()
  @Header('Content-Type', 'application/json')
  async handle(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    try {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) headers[k.toLowerCase()] = String(v[0] ?? '');
        else if (typeof v === 'string') headers[k.toLowerCase()] = v;
      }
      // req.rawBody is set by the express.json verify middleware in main.ts
      const payload = req.rawBody;
      await this.subscriptionsService.handleWebhook(payload, headers);
      return res.status(200).send('OK');
    } catch (err) {
      if (err instanceof BadRequestException) {
        return res.status(400).send(err.message);
      }
      return res.status(400).send('Invalid signature');
    }
  }
}

@Controller('automation/webhooks/mercadopago')
@Throttle({ default: { limit: 300, ttl: 60_000 } })
export class MercadoPagoWebhookController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Post()
  @Header('Content-Type', 'application/json')
  async handle(@Body() payload: unknown, @Req() req: Request, @Res() res: Response) {
    try {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) headers[k.toLowerCase()] = String(v[0] ?? '');
        else if (typeof v === 'string') headers[k.toLowerCase()] = v;
      }
      await this.subscriptionsService.handleWebhook(payload, headers);
      return res.status(200).send('OK');
    } catch (err) {
      if (err instanceof BadRequestException) {
        return res.status(400).send(err.message);
      }
      return res.status(400).send('Invalid signature');
    }
  }
}

@Controller('automation-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class SubscriptionsAdminController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Post('mark-paid')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async manualMarkPaid(
    @CurrentUser() user: User,
    @Body(new ZodPipe(manualPaySchema)) body: unknown,
  ) {
    const data = body as { id: string };
    // SECURITY CR1: scope by the caller's organization so an OWNER cannot
    // mark another tenant's subscription as paid.
    return this.subscriptionsService.markPaid(data.id, user.organizationId);
  }
}
