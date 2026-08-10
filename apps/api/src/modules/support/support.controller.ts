import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SupportGuard } from '../../common/guards/support.guard';
import {
  SupportStatus,
  CompanySize,
  updateSupportStatusSchema,
  updateCompanySizeSchema,
  idParamSchema,
} from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('support')
@UseGuards(JwtAuthGuard, SupportGuard)
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Get('organizations')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getOrganizations() {
    return this.supportService.getAllOrganizations();
  }

  @Get('organizations/:id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getOrganization(@Param(new ZodPipe(idParamSchema)) params: { id: string }) {
    return this.supportService.getOrganizationDetails(params.id);
  }

  @Patch('organizations/:id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async updateStatus(
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @Body(new ZodPipe(updateSupportStatusSchema)) body: { status: SupportStatus },
  ) {
    return this.supportService.updateSupportStatus(params.id, body.status);
  }

  @Patch('organizations/:id/size')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async updateSize(
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @Body(new ZodPipe(updateCompanySizeSchema)) body: { size: CompanySize },
  ) {
    return this.supportService.updateCompanySize(params.id, body.size);
  }
}
