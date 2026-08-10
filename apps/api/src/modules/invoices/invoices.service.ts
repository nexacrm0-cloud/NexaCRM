import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';
import { ProductsService } from '../inventory/products.service';
import type { AfipProvider } from '../afip/afip-provider.interface';
import { AFIP_DOC_TYPE } from '../afip/afip.constants';
import crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
import PDFDocument from 'pdfkit';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private inventory: ProductsService,
    @Optional() @Inject('AFIP_PROVIDER') private afip?: AfipProvider,
  ) {}

  async findAll(organizationId: string, params: { page: number; limit: number; status?: string }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, companyName: true, contactName: true, email: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          items: true,
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, organizationId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        client: { select: { id: true, companyName: true, contactName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: true,
        quote: { select: { id: true, number: true, title: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    return invoice;
  }

  async create(organizationId: string, data: any, userId: string) {
    const number = await this.prisma.$transaction(async (tx) => {
      const lastInvoice = await tx.invoice.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        select: { number: true },
      });
      const lastNum = lastInvoice ? parseInt(lastInvoice.number, 10) : 0;
      return String(lastNum + 1).padStart(8, '0');
    });
    const subtotal = data.items.reduce((sum: number, item: any) => {
      const lineTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      return sum + lineTotal;
    }, 0);
    const taxAmount = subtotal * (data.taxRate / 100);
    const total = subtotal + taxAmount;

    const invoice = await this.prisma.invoice.create({
      data: {
        title: data.title || null,
        number,
        invoiceType: data.invoiceType || 'B',
        pointOfSale: data.pointOfSale || '0001',
        subtotal,
        taxRate: data.taxRate || 0,
        taxAmount,
        total,
        notes: data.notes || null,
        terms: data.terms || null,
        cuit: data.cuit || null,
        ivaCondition: data.ivaCondition || null,
        clientId: data.clientId,
        quoteId: data.quoteId || null,
        organizationId,
        createdById: userId,
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
        client: { select: { id: true, companyName: true, contactName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
    });

    this.eventBus.emit({
      eventName: 'invoice.created',
      aggregateType: 'invoice',
      aggregateId: invoice.id,
      payload: { invoiceId: invoice.id, number: invoice.number, total: invoice.total },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return invoice;
  }

  async createFromQuote(organizationId: string, quoteId: string, userId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, organizationId },
      include: { items: true, client: true },
    });
    if (!quote) throw new NotFoundException('Presupuesto no encontrado');

    const quoteData: any = {
      title: `Factura: ${quote.title}`,
      clientId: quote.clientId,
      taxRate: Number(quote.taxRate),
      items: quote.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      })),
      cuit: (quote.client as any)?.cuit || null,
      ivaCondition: (quote.client as any)?.ivaCondition || null,
      quoteId: quote.id,
    };

    return this.create(organizationId, quoteData, userId);
  }

  async update(id: string, organizationId: string, data: any, userId: string) {
    const existing = await this.prisma.invoice.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Factura no encontrada');
    if (existing.status !== 'DRAFT')
      throw new BadRequestException('Solo se pueden editar facturas en borrador');

    let subtotal = Number(existing.subtotal);
    const taxRate = data.taxRate !== undefined ? data.taxRate : Number(existing.taxRate);
    let taxAmount = Number(existing.taxAmount);
    let total = Number(existing.total);

    if (data.items) {
      subtotal = data.items.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unitPrice,
        0,
      );
      taxAmount = subtotal * (taxRate / 100);
      total = subtotal + taxAmount;
    }

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title || null }),
        ...(data.invoiceType !== undefined && { invoiceType: data.invoiceType }),
        ...(data.pointOfSale !== undefined && { pointOfSale: data.pointOfSale }),
        ...(data.taxRate !== undefined && { taxRate: data.taxRate }),
        ...(data.cuit !== undefined && { cuit: data.cuit || null }),
        ...(data.ivaCondition !== undefined && { ivaCondition: data.ivaCondition || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.terms !== undefined && { terms: data.terms || null }),
        subtotal,
        taxAmount,
        total,
        ...(data.items && {
          items: {
            deleteMany: {},
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
        }),
      },
      include: {
        client: { select: { id: true, companyName: true, contactName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
    });

    this.eventBus.emit({
      eventName: 'invoice.updated',
      aggregateType: 'invoice',
      aggregateId: invoice.id,
      payload: { invoiceId: invoice.id, number: invoice.number },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return invoice;
  }

  async issue(id: string, organizationId: string, userId: string) {
    const existing = await this.prisma.invoice.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Factura no encontrada');
    if (existing.status !== 'DRAFT')
      throw new BadRequestException('Solo se pueden emitir facturas en borrador');

    // If any line item is linked to a productVariant, drain atomically here.
    // Items missing productVariantId fall back gracefully (no stock check).
    const items = await this.prisma.invoiceItem.findMany({
      where: { invoiceId: id, productVariantId: { not: null } },
      select: { id: true, productVariantId: true, quantity: true, description: true },
    });
    if (items.length > 0) {
      await this.inventory.drainForInvoice(
        organizationId,
        items.map((it) => ({
          productVariantId: it.productVariantId as string,
          quantity: Math.max(1, Math.ceil(Number(it.quantity))),
          description: it.description,
        })),
        id,
      );
    }

    // === AFIP WSFE: pedir CAE antes de emitir ===
    // Solo si el provider esta disponible y la org tiene AFIP habilitado.
    // Si AFIP falla, compensamos el stock drenado y la factura queda en DRAFT.
    let afipData: { cae: string; caeExpiresAt: Date; number: string } | null = null;
    if (this.afip && process.env.AFIP_ENABLED === 'true') {
      try {
        const afipResult = await this.afip.requestCae({
          invoiceType: existing.invoiceType,
          pointOfSale: existing.pointOfSale,
          date: new Date(),
          concepto: items.length > 0 ? 1 : 2, // productos si hay items con stock, servicios si no
          docType: existing.cuit ? AFIP_DOC_TYPE.CUIT : AFIP_DOC_TYPE.CONSUMIDOR_FINAL,
          docNumber: existing.cuit,
          subtotal: Number(existing.subtotal),
          taxRate: Number(existing.taxRate),
          taxAmount: Number(existing.taxAmount),
          total: Number(existing.total),
        });
        afipData = {
          cae: afipResult.cae,
          caeExpiresAt: afipResult.caeExpiresAt,
          number: afipResult.invoiceNumber.padStart(8, '0'),
        };
      } catch (err) {
        // Compensacion: devolver el stock drenado
        if (items.length > 0) {
          await this.inventory.releaseForInvoice(id, organizationId).catch((relErr) => {
            this.logger.error(
              `Compensacion de stock fallo para factura ${id}: ${relErr instanceof Error ? relErr.message : 'unknown'}`,
            );
          });
        }
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        throw new BadRequestException(`No se pudo emitir la factura: ${msg}`);
      }
    }

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'ISSUED',
        issuedAt: new Date(),
        ...(afipData
          ? {
              number: afipData.number,
              cae: afipData.cae,
              caeExpiresAt: afipData.caeExpiresAt,
            }
          : {}),
      },
      include: {
        client: { select: { id: true, companyName: true, contactName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
    });

    this.eventBus.emit({
      eventName: 'invoice.issued',
      aggregateType: 'invoice',
      aggregateId: invoice.id,
      payload: {
        invoiceId: invoice.id,
        number: invoice.number,
        total: Number(invoice.total),
        clientId: invoice.client?.id ?? null,
        clientEmail: (invoice as any).client?.email ?? null,
        clientName: invoice.client?.companyName ?? null,
        cae: invoice.cae ?? null,
        caeExpiresAt: invoice.caeExpiresAt ?? null,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return invoice;
  }

  async pay(id: string, organizationId: string, userId: string) {
    const existing = await this.prisma.invoice.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Factura no encontrada');
    if (existing.status !== 'ISSUED')
      throw new BadRequestException('Solo se pueden cobrar facturas emitidas');

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
      include: {
        client: { select: { id: true, companyName: true, contactName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
    });

    this.eventBus.emit({
      eventName: 'invoice.paid',
      aggregateType: 'invoice',
      aggregateId: invoice.id,
      payload: {
        invoiceId: invoice.id,
        number: invoice.number,
        total: Number(invoice.total),
        clientId: invoice.client?.id ?? null,
        clientEmail: (invoice as any).client?.email ?? null,
        clientName: invoice.client?.companyName ?? null,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return invoice;
  }

  async cancel(id: string, organizationId: string, userId: string) {
    const existing = await this.prisma.invoice.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Factura no encontrada');
    if (existing.status === 'CANCELLED')
      throw new BadRequestException('La factura ya está cancelada');

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: {
        client: { select: { id: true, companyName: true, contactName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
    });

    this.eventBus.emit({
      eventName: 'invoice.cancelled',
      aggregateType: 'invoice',
      aggregateId: invoice.id,
      payload: {
        invoiceId: invoice.id,
        number: invoice.number,
        clientId: invoice.client?.id ?? null,
        clientEmail: (invoice as any).client?.email ?? null,
        clientName: invoice.client?.companyName ?? null,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return invoice;
  }

  async remove(id: string, organizationId: string, userId: string) {
    const existing = await this.prisma.invoice.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Factura no encontrada');

    await this.prisma.invoice.delete({ where: { id } });

    this.eventBus.emit({
      eventName: 'invoice.deleted',
      aggregateType: 'invoice',
      aggregateId: id,
      payload: { invoiceId: id },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return { success: true, message: 'Factura eliminada' };
  }

  async generatePdf(id: string, organizationId: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        client: true,
        createdBy: true,
        organization: { select: { name: true } },
        items: true,
      },
    });

    if (!invoice) throw new NotFoundException('Factura no encontrada');

    const typeLabel =
      invoice.invoiceType === 'A'
        ? 'FACTURA A'
        : invoice.invoiceType === 'B'
          ? 'FACTURA B'
          : invoice.invoiceType === 'C'
            ? 'FACTURA C'
            : invoice.invoiceType === 'E'
              ? 'FACTURA E'
              : invoice.invoiceType === 'M'
                ? 'FACTURA M'
                : 'FACTURA';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(24).font('Helvetica-Bold').text('Nexa CRM', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(invoice.organization.name, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(20).font('Helvetica-Bold').text(typeLabel, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').text(`N°: ${invoice.number}`, { align: 'center' });
      if (invoice.pointOfSale) {
        doc.fontSize(10).text(`Punto de venta: ${invoice.pointOfSale}`, { align: 'center' });
      }
      doc.moveDown(1);

      doc.fontSize(10).font('Helvetica-Bold').text('Cliente:');
      doc.font('Helvetica').text(invoice.client.companyName);
      doc.text(`Attn: ${invoice.client.contactName}`);
      if (invoice.client.email) doc.text(`Email: ${invoice.client.email}`);
      if (invoice.client.phone) doc.text(`Tel: ${invoice.client.phone}`);
      if (invoice.cuit) doc.text(`CUIT: ${invoice.cuit}`);
      if (invoice.ivaCondition) doc.text(`Condición IVA: ${invoice.ivaCondition}`);
      doc.moveDown(1);

      if (invoice.issuedAt) {
        doc.font('Helvetica-Bold').text('Fecha de emisión:');
        doc.font('Helvetica').text(invoice.issuedAt.toLocaleDateString());
        doc.moveDown(1);
      }
      if (invoice.paidAt) {
        doc.font('Helvetica-Bold').text('Fecha de pago:');
        doc.font('Helvetica').text(invoice.paidAt.toLocaleDateString());
        doc.moveDown(1);
      }

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
      for (const item of invoice.items) {
        doc.text(item.description, 50, y);
        doc.text(String(item.quantity), 350, y);
        doc.text(`$${Number(item.unitPrice).toFixed(2)}`, 400, y);
        doc.text(`$${Number(item.total).toFixed(2)}`, 450, y);
        y += 20;
      }

      doc.moveDown(1);
      doc
        .font('Helvetica-Bold')
        .text(`Subtotal: $${Number(invoice.subtotal).toFixed(2)}`, { align: 'right' });
      doc.text(`IVA (${Number(invoice.taxRate)}%): $${Number(invoice.taxAmount).toFixed(2)}`, {
        align: 'right',
      });
      doc.fontSize(14).text(`TOTAL: $${Number(invoice.total).toFixed(2)}`, { align: 'right' });

      if (invoice.notes) {
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica-Bold').text('Notas:');
        doc.font('Helvetica').text(invoice.notes);
      }
      if (invoice.terms) {
        doc.moveDown(1);
        doc.font('Helvetica-Bold').text('Términos:');
        doc.font('Helvetica').text(invoice.terms);
      }
      if (invoice.cae) {
        doc.moveDown(1);
        doc.fontSize(9).fillColor('#666').text(`CAE: ${invoice.cae}`);
        if (invoice.caeExpiresAt) {
          doc.text(`Vto. CAE: ${new Date(invoice.caeExpiresAt).toLocaleDateString('es-AR')}`);
        }
        doc.fillColor('black');
      }

      doc.end();
    });
  }
}
