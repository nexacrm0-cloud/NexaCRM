export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
}

export interface EmailProvider {
  readonly name: string;
  send(options: SendEmailOptions): Promise<SendEmailResult>;
}
