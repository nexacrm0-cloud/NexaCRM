import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, SendEmailOptions, SendEmailResult } from './email-provider.interface';

@Injectable()
export class LogEmailProvider implements EmailProvider {
  readonly name = 'log';
  private readonly logger = new Logger(LogEmailProvider.name);

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const { to, subject, html, attachments } = options;
    const attInfo = attachments?.length
      ? ` +${attachments.length} attachment(s)[${attachments.map((a) => `${a.filename} ${a.content.length}b`).join(', ')}]`
      : '';
    this.logger.log(`[EMAIL] To: ${to}, Subject: ${subject}${attInfo}`);
    this.logger.debug(`Content: ${html.substring(0, 200)}...`);
    return { success: true, messageId: `log-${Date.now()}`, provider: 'log' };
  }
}
