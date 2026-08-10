import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { HmacService } from '../../common/services/hmac.service';
import { whatsappWebhookSchema } from '@nexa/shared';

@Controller('webhooks/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private whatsappService: WhatsAppService,
    private hmacService: HmacService,
  ) {}

  @Post('incoming')
  @HttpCode(HttpStatus.OK)
  // Dedicated high cap: legitimate traffic from Meta uses a single-source
  // IP set; aggressive flooding from attacker IPs should bypass it. Do not
  // share the global 120/min bucket with the rest of the app.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async handleIncoming(@Req() req: Request, @Body() rawBody: unknown) {
    // SECURITY A2: HMAC signature verification is MANDATORY and runs BEFORE
    // schema validation. Putting the Zod pipe on @Body() would make Nest run
    // the validator during param resolution, before this handler body — which
    // means an unsigned malformed payload would get a 400 (validation) instead
    // of a 401 (unauthorized), turning the schema into a format oracle that
    // leaks information about whether a guess matched the expected shape. We
    // deliberately read the raw body and validate the schema AFTER the
    // signature check so the only observable behavior for an unsigned request
    // is "signature missing/invalid".
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Webhook signature verification not configured');
      }
      this.logger.warn(
        'WHATSAPP_APP_SECRET not set; accepting webhook in dev mode without verification',
      );
    } else {
      const signature =
        (req.headers['x-hub-signature-256'] as string) ||
        (req.headers['x-hub-signature'] as string);
      if (!signature) {
        this.logger.warn('WhatsApp webhook rejected: missing signature header');
        throw new UnauthorizedException('Missing webhook signature');
      }
      // Meta signs the raw body bytes, NOT the parsed JSON
      const rawBodyBuf = (req as any).rawBody as Buffer | undefined;
      if (!rawBodyBuf) {
        throw new BadRequestException('Raw body not available for signature verification');
      }
      const isValid = this.hmacService.verify(
        rawBodyBuf.toString('utf8'),
        signature.replace(/^sha256=/, ''),
        appSecret,
      );
      if (!isValid) {
        this.logger.warn('WhatsApp webhook signature mismatch');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    // Signature is valid (or dev mode without secret). Now apply the Zod
    // schema to the parsed body. A failure here is a real Meta payload that
    // doesn't match the expected envelope — typically a schema drift after
    // a Meta API upgrade — so we surface it as a 400 with context.
    const parsed = whatsappWebhookSchema.safeParse(rawBody);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      this.logger.warn(`WhatsApp webhook schema mismatch: ${JSON.stringify(errors)}`);
      throw new BadRequestException({
        message: 'Invalid WhatsApp webhook payload',
        errors,
      });
    }
    const body = parsed.data;

    const change = body.entry?.[0]?.changes?.[0]?.value;
    const messages = change?.messages;

    if (!messages || messages.length === 0) {
      if (change?.statuses) {
        const status = change.statuses[0];
        return this.whatsappService.handleStatusCallback({
          messageId: status.id,
          status: status.status,
          recipientId: status.recipient_id ?? '',
        });
      }
      return { status: 'ok' };
    }

    const msg = messages[0];

    if (msg.type === 'text') {
      return this.whatsappService.handleIncomingMessage({
        phoneNumberId: change.metadata?.phone_number_id ?? '',
        from: msg.from ?? '',
        messageBody: msg.text?.body ?? '',
        messageId: msg.id,
        timestamp: msg.timestamp ?? '',
      });
    }

    return { status: 'unsupported_message_type' };
  }

  @Get('incoming')
  @HttpCode(HttpStatus.OK)
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    // SECURITY A1: never fall back to a hardcoded-known token; require the
    // operator to set WHATSAPP_VERIFY_TOKEN. Without it, Meta callback
    // verification cannot complete — safer than silently accepting a public
    // value that an attacker could use to take over the webhook.
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!verifyToken) {
      throw new BadRequestException('Verification token not configured');
    }

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }

    throw new BadRequestException('Verification failed');
  }
}
