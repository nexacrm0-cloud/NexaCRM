import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { SearchService } from './search.service';
import { z } from 'zod';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodPipe(searchQuerySchema)) query: z.infer<typeof searchQuerySchema>,
  ) {
    return this.searchService.search(user.organizationId, query.q, {
      entityType: query.type,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
