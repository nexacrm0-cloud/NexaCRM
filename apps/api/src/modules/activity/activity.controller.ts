import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

@Controller('activity')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('clientId') clientId?: string,
    @Query('dealId') dealId?: string,
  ) {
    if (page < 1) throw new BadRequestException('Page must be >= 1');
    if (limit < 1) throw new BadRequestException('Limit must be > 0');
    return this.activityService.findAll(user.organizationId, { clientId, dealId, page, limit });
  }
}
