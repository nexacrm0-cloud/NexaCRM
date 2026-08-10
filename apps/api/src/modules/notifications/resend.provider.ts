import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailProvider, SendEmailOptions, SendEmailResult } from './email-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendEmailProvider.name);
  private client: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.client = new Resend(apiKey);
      this.logger.log('Resend email provider initialized');
    } else {
      this.logger.warn('RESEND_API_KEY not set — emails will be logged only (dry-run mode)');
    }
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const { to, subject, html, text, attachments } = options;

    if (!this.client) {
      this.logger.log(
        `[DRY-RUN] To: ${to}, Subject: ${subject}${attachments ? ` (with ${attachments.length} attachment(s))` : ''}`,
      );
      return { success: true, messageId: `dry-run-${Date.now()}`, provider: 'resend(dev)' };
    }

    try {
      const resendAttachments = attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        ...(a.contentType ? { contentType: a.contentType } : {}),
      }));

      const { data, error } = await this.client.emails.send({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        ...(resendAttachments && resendAttachments.length > 0
          ? { attachments: resendAttachments }
          : {}),
      });

      if (error) {
        this.logger.error(`Resend API error: ${error.message}`);
        return { success: false, provider: 'resend' };
      }

      return { success: true, messageId: data?.id, provider: 'resend' };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
