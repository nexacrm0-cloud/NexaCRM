import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';
import { NotificationsService } from '../notifications/notifications.service';
import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private notifications: NotificationsService,
  ) {}

  async findAll(organizationId: string, params: { status?: string; page: number; limit: number }) {
    const { status, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, companyName: true, contactName: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          items: true,
        },
      }),
      this.prisma.quote.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, organizationId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, organizationId },
      include: {
        client: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        deal: { select: { id: true, title: true } },
        items: true,
        activityLogs: {
          include: { user: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!quote) throw new NotFoundException('Presupuesto no encontrado');
    return quote;
  }

  async create(organizationId: string, data: any, userId: string) {
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException('Debe incluir al menos un item');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: data.clientId, organizationId },
    });
    if (!client) throw new BadRequestException('Cliente no encontrado');

    if (data.dealId) {
      const deal = await this.prisma.deal.findFirst({ where: { id: data.dealId, organizationId } });
      if (!deal) throw new BadRequestException('Oportunidad no encontrada');
    }

    const items = data.items.map((item: any) => {
      const lineTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        productVariantId: item.productVariantId || null,
        total: lineTotal,
      };
    });

    const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
    const taxRate = data.taxRate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const result = await this.prisma.$transaction(async (tx) => {
      const countResult = await tx.$queryRaw<
        { nextval: number }[]
      >`SELECT nextval('quote_number_seq') as nextval`;
      const seqNumber = countResult[0]?.nextval || 1;
      const number = `COT-${String(seqNumber).padStart(5, '0')}`;

      const q = await tx.quote.create({
        data: {
          number,
          title: data.title,
          subtotal,
          taxRate,
          taxAmount,
          total,
          notes: data.notes || null,
          terms: data.terms || null,
          validUntil: data.validUntil
            ? new Date(data.validUntil)
            : new Date(Date.now() + 30 * 86400000),
          clientId: data.clientId,
          dealId: data.dealId || null,
          createdById: userId,
          organizationId,
          items: {
            create: data.items.map((item: any) => {
              const lineTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
              return {
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount || 0,
                productVariantId: item.productVariantId || null,
                total: lineTotal,
              };
            }),
          },
        },
        include: {
          client: { select: { companyName: true, contactName: true } },
          items: true,
        },
      });

      return { quote: q, number };
    });

    this.eventBus.emit({
      eventName: 'quote.created',
      aggregateType: 'quote',
      aggregateId: result.quote.id,
      payload: {
        quoteId: result.quote.id,
        number: result.number,
        clientId: data.clientId,
        total,
        status: 'DRAFT',
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return result.quote;
  }

  async update(id: string, organizationId: string, data: any, userId: string) {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.terms !== undefined) updateData.terms = data.terms;
    if (data.taxRate !== undefined) updateData.taxRate = data.taxRate;
    if (data.validUntil !== undefined)
      updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;

    if (data.items) {
      if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new BadRequestException('Debe incluir al menos un item');
      }
      const items = data.items.map((item: any) => {
        const lineTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
        return {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          productVariantId: item.productVariantId || null,
          total: lineTotal,
        };
      });
      const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
      updateData.subtotal = subtotal;
      updateData.items = { deleteMany: {}, create: items };
    }

    const [quote] = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.quote.findFirst({
        where: { id, organizationId },
      });
      if (!existing) throw new NotFoundException('Presupuesto no encontrado');
      if (existing.status !== 'DRAFT')
        throw new BadRequestException('Solo se pueden editar presupuestos en borrador');

      const finalTaxRate = data.taxRate ?? existing.taxRate;
      const finalSubtotal = updateData.subtotal ?? existing.subtotal;
      const taxAmount = finalSubtotal * (finalTaxRate / 100);
      if (updateData.subtotal !== undefined || data.taxRate !== undefined) {
        updateData.taxAmount = taxAmount;
        updateData.total = finalSubtotal + taxAmount;
      }

      const updated = await tx.quote.update({
        where: { id, organizationId },
        data: updateData,
        include: { client: true, items: true },
      });

      return [updated];
    });

    this.eventBus.emit({
      eventName: 'quote.updated',
      aggregateType: 'quote',
      aggregateId: id,
      payload: {
        quoteId: id,
        number: quote.number,
        clientId: quote.clientId,
        total: Number(quote.total),
        status: quote.status,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return quote;
  }

  async send(id: string, organizationId: string, userId: string) {
    const [updated, quote] = await this.prisma.$transaction(async (tx) => {
      const found = await tx.quote.findFirst({
        where: { id, organizationId },
        include: {
          client: { select: { email: true, contactName: true, companyName: true } },
        },
      });
      if (!found) throw new NotFoundException('Presupuesto no encontrado');
      if (found.status !== 'DRAFT')
        throw new BadRequestException('Solo se pueden enviar presupuestos en borrador');

      const updated = await tx.quote.update({
        where: { id, organizationId },
        data: { status: 'SENT', sentAt: new Date() },
      });

      return [updated, found];
    });

    this.eventBus.emit({
      eventName: 'quote.sent',
      aggregateType: 'quote',
      aggregateId: id,
      payload: {
        quoteId: id,
        number: quote.number,
        clientId: quote.clientId,
        total: Number(quote.total),
        status: 'SENT',
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    if (quote.client.email) {
      try {
        const pdfBuffer = await this.generatePdf(id, organizationId);
        await this.notifications.sendQuoteEmail(id, quote.number, quote.client.email, pdfBuffer);
        this.logger.log(`Quote ${quote.number} emailed to ${quote.client.email}`);
      } catch (error: unknown) {
        this.logger.error(
          `Failed to email quote ${quote.number}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } else {
      this.logger.warn(`Quote ${quote.number} has no client email — skipping email`);
    }

    return updated;
  }

  async accept(id: string, organizationId: string, userId: string) {
    const [updated, quote] = await this.prisma.$transaction(async (tx) => {
      const found = await tx.quote.findFirst({
        where: { id, organizationId },
      });
      if (!found) throw new NotFoundException('Presupuesto no encontrado');
      if (found.status !== 'SENT')
        throw new BadRequestException('Solo se pueden aceptar presupuestos enviados');

      const updated = await tx.quote.update({
        where: { id, organizationId },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      return [updated, found];
    });

    this.eventBus.emit({
      eventName: 'quote.accepted',
      aggregateType: 'quote',
      aggregateId: id,
      payload: { quoteId: id, number: quote.number, clientId: quote.clientId },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return updated;
  }

  async reject(id: string, organizationId: string, reason: string | undefined, userId: string) {
    const [updated, quote] = await this.prisma.$transaction(async (tx) => {
      const found = await tx.quote.findFirst({
        where: { id, organizationId },
      });
      if (!found) throw new NotFoundException('Presupuesto no encontrado');
      if (found.status === 'ACCEPTED' || found.status === 'REJECTED') {
        throw new BadRequestException('No se puede rechazar un presupuesto ya procesado');
      }

      const updated = await tx.quote.update({
        where: { id, organizationId },
        data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason || null },
      });

      return [updated, found];
    });

    this.eventBus.emit({
      eventName: 'quote.rejected',
      aggregateType: 'quote',
      aggregateId: id,
      payload: { quoteId: id, number: quote.number, clientId: quote.clientId, reason },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return updated;
  }

  async generatePdf(id: string, organizationId: string): Promise<Buffer> {
    const quote = await this.prisma.quote.findFirst({
      where: { id, organizationId },
      include: {
        client: true,
        createdBy: true,
        organization: { select: { name: true } },
        items: true,
      },
    });

    if (!quote) throw new NotFoundException('Presupuesto no encontrado');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(24).font('Helvetica-Bold').text('Nexa CRM', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(quote.organization.name, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(20).font('Helvetica-Bold').text('PRESUPUESTO', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').text(`N°: ${quote.number}`, { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(10).font('Helvetica-Bold').text('Cliente:');
      doc.font('Helvetica').text(`${quote.client.companyName}`);
      doc.text(`Attn: ${quote.client.contactName}`);
      if (quote.client.email) doc.text(`Email: ${quote.client.email}`);
      doc.moveDown(1);

      doc.font('Helvetica-Bold').text('Válido hasta:');
      doc.font('Helvetica').text(quote.validUntil ? quote.validUntil.toLocaleDateString() : 'N/A');
      doc.moveDown(1);

      doc.fontSize(10).font('Helvetica-Bold').text('Items:', { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.font('Helvetica-Bold').text('Descripción', 50, tableTop);
      doc.text('Cant.', 350, tableTop);
      doc.text('P/U', 400, tableTop);
      doc.text('Total', 450, tableTop);

      doc.moveDown(0.5);
      let y = doc.y;

      doc.font('Helvetica');
      for (const item of quote.items) {
        doc.text(item.description, 50, y);
        doc.text(String(item.quantity), 350, y);
        doc.text(`$${Number(item.unitPrice).toFixed(2)}`, 400, y);
        doc.text(`$${Number(item.total).toFixed(2)}`, 450, y);
        y += 20;
      }

      doc.moveDown(1);
      doc
        .font('Helvetica-Bold')
        .text(`Subtotal: $${Number(quote.subtotal).toFixed(2)}`, { align: 'right' });
      doc.text(`IVA (${Number(quote.taxRate)}%): $${Number(quote.taxAmount).toFixed(2)}`, {
        align: 'right',
      });
      doc.fontSize(14).text(`TOTAL: $${Number(quote.total).toFixed(2)}`, { align: 'right' });

      if (quote.notes) {
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica-Bold').text('Notas:');
        doc.font('Helvetica').text(quote.notes);
      }

      if (quote.terms) {
        doc.moveDown(1);
        doc.font('Helvetica-Bold').text('Términos:');
        doc.font('Helvetica').text(quote.terms);
      }

      doc.end();
    });
  }

  async remove(id: string, organizationId: string, userId: string) {
    const [existing] = await this.prisma.$transaction(async (tx) => {
      const found = await tx.quote.findFirst({
        where: { id, organizationId },
      });
      if (!found) throw new NotFoundException('Presupuesto no encontrado');
      if (found.status !== 'DRAFT')
        throw new BadRequestException('Solo se pueden eliminar presupuestos en borrador');

      await tx.quote.delete({ where: { id, organizationId } });
      return [found];
    });

    this.eventBus.emit({
      eventName: 'quote.deleted',
      aggregateType: 'quote',
      aggregateId: id,
      payload: { quoteId: id, number: existing.number },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });
  }
}
