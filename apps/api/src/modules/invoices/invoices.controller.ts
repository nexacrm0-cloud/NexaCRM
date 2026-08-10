import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { createInvoiceSchema, updateInvoiceSchema, UserRole } from '@nexa/shared';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.invoicesService.findAll(user.organizationId, { page, limit, status });
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.findOne(id, user.organizationId);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(createInvoiceSchema)) body: unknown,
  ) {
    return this.invoicesService.create(user.organizationId, body as any, user.id);
  }

  @Post('from-quote/:quoteId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async createFromQuote(@CurrentUser() user: AuthenticatedUser, @Param('quoteId') quoteId: string) {
    return this.invoicesService.createFromQuote(user.organizationId, quoteId, user.id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateInvoiceSchema)) body: unknown,
  ) {
    return this.invoicesService.update(id, user.organizationId, body as any, user.id);
  }

  @Patch(':id/issue')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async issue(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.issue(id, user.organizationId, user.id);
  }

  @Patch(':id/pay')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async pay(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.pay(id, user.organizationId, user.id);
  }

  @Patch(':id/cancel')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.cancel(id, user.organizationId, user.id);
  }

  @Get(':id/pdf')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async generatePdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.invoicesService.generatePdf(id, user.organizationId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="factura-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.remove(id, user.organizationId, user.id);
  }
}
