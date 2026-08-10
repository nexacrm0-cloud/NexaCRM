import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEvent } from '@nexa/domain';
import { PrismaService } from '@nexa/database';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { InvoicesService } from '../../modules/invoices/invoices.service';

@Injectable()
export class InvoiceEmailHandler {
  private readonly logger = new Logger(InvoiceEmailHandler.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private invoices: InvoicesService,
  ) {}

  @OnEvent('invoice.issued')
  async handleIssued(event: DomainEvent) {
    const p = event.payload as Record<string, unknown>;
    const invoiceId = String(p.invoiceId ?? '');
    if (!invoiceId) return;
    const to = (p.clientEmail as string | null) ?? null;
    if (!to) {
      this.logger.warn(`Cannot email invoice ${invoiceId}: client has no email on file.`);
      return;
    }
    try {
      const pdf = await this.invoices.generatePdf(invoiceId, event.metadata.organizationId);
      await this.notifications.sendInvoiceEmail({
        invoiceId,
        invoiceNumber: String(p.number ?? ''),
        to,
        clientName: (p.clientName as string | null) ?? null,
        total: typeof p.total === 'number' ? p.total : undefined,
        currency: 'ARS',
        pdfBuffer: pdf,
        kind: 'issued',
      });
      this.logger.log(`Invoice ${p.number} emailed to ${to}`);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to email invoice ${invoiceId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  @OnEvent('invoice.paid')
  async handlePaid(event: DomainEvent) {
    const p = event.payload as Record<string, unknown>;
    const invoiceId = String(p.invoiceId ?? '');
    if (!invoiceId) return;
    const to = (p.clientEmail as string | null) ?? null;
    if (!to) return;
    try {
      const pdf = await this.invoices.generatePdf(invoiceId, event.metadata.organizationId);
      await this.notifications.sendInvoiceEmail({
        invoiceId,
        invoiceNumber: String(p.number ?? ''),
        to,
        clientName: (p.clientName as string | null) ?? null,
        total: typeof p.total === 'number' ? p.total : undefined,
        currency: 'ARS',
        pdfBuffer: pdf,
        kind: 'paid',
      });
      this.logger.log(`Payment confirmation for ${p.number} emailed to ${to}`);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to email paid invoice ${invoiceId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  @OnEvent('invoice.cancelled')
  async handleCancelled(event: DomainEvent) {
    const p = event.payload as Record<string, unknown>;
    const invoiceId = String(p.invoiceId ?? '');
    if (!invoiceId) return;
    const to = (p.clientEmail as string | null) ?? null;
    if (!to) return;
    try {
      await this.notifications.sendInvoiceEmail({
        invoiceId,
        invoiceNumber: String(p.number ?? ''),
        to,
        clientName: (p.clientName as string | null) ?? null,
        total: typeof p.total === 'number' ? p.total : undefined,
        currency: 'ARS',
        kind: 'cancelled',
      });
      this.logger.log(`Cancellation for ${p.number} emailed to ${to}`);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to email cancelled invoice ${invoiceId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
