import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  BadRequestException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { QuotesService } from './quotes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { UserRole } from '@nexa/shared';
import { createQuoteSchema, updateQuoteSchema } from '@nexa/shared';
import { z } from 'zod';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const rejectQuoteSchema = z.object({
  reason: z.string().optional(),
});

@Controller('quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    if (page < 1) throw new BadRequestException('Page must be >= 1');
    if (limit < 1) throw new BadRequestException('Limit must be > 0');
    return this.quotesService.findAll(user.organizationId, {
      status,
      page,
      limit,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.quotesService.findOne(id, user.organizationId);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(createQuoteSchema)) body: unknown,
  ) {
    const data = body as any;
    return this.quotesService.create(user.organizationId, data, user.id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateQuoteSchema)) body: unknown,
  ) {
    return this.quotesService.update(id, user.organizationId, body as any, user.id);
  }

  @Patch(':id/send')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.quotesService.send(id, user.organizationId, user.id);
  }

  @Patch(':id/accept')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.quotesService.accept(id, user.organizationId, user.id);
  }

  @Patch(':id/reject')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodPipe(rejectQuoteSchema)) body: { reason?: string },
  ) {
    return this.quotesService.reject(id, user.organizationId, body.reason, user.id);
  }

  @Get(':id/pdf')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async generatePdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.quotesService.generatePdf(id, user.organizationId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="quote-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.quotesService.remove(id, user.organizationId, user.id);
    return { success: true, message: 'Presupuesto eliminado exitosamente' };
  }
}
