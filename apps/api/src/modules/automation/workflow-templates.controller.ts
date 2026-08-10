import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkflowsEnabledGuard } from '../../common/guards/workflows-enabled.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@nexa/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { z } from 'zod';
import { User } from '@nexa/database';
import { WorkflowTemplatesService } from './workflow-templates.service';

const installSchema = z.object({
  slug: z.string().min(1),
  params: z.record(z.unknown()).default({}),
});

const setFeaturedSchema = z.object({
  isFeatured: z.boolean(),
});

const setPrivateSchema = z.object({
  isPrivate: z.boolean(),
});

@Controller('automation/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
export class WorkflowTemplatesController {
  constructor(private templatesService: WorkflowTemplatesService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async list(@Query('category') category?: string, @Query('search') search?: string) {
    return this.templatesService.list(category, search);
  }

  @Get(':slug')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getOne(@Param('slug') slug: string) {
    return this.templatesService.getBySlug(slug);
  }

  @Post('install')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @UseGuards(WorkflowsEnabledGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async install(@CurrentUser() user: User, @Body(new ZodPipe(installSchema)) body: unknown) {
    const data = body as { slug: string; params: Record<string, unknown> };
    return this.templatesService.install(user.organizationId, user.id, data);
  }

  @Patch(':slug/featured')
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async setFeatured(
    @Param('slug') slug: string,
    @Body(new ZodPipe(setFeaturedSchema)) body: unknown,
  ) {
    const data = body as { isFeatured: boolean };
    return this.templatesService.setFeatured(slug, data.isFeatured);
  }
}

@Controller('automation/templates-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class WorkflowTemplatesAdminController {
  constructor(private templatesService: WorkflowTemplatesService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async list() {
    return this.templatesService.adminList();
  }

  @Patch(':slug/visibility')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async setPrivate(
    @Param('slug') slug: string,
    @Body(new ZodPipe(setPrivateSchema)) body: unknown,
  ) {
    const data = body as { isPrivate: boolean };
    return this.templatesService.setPrivate(slug, data.isPrivate);
  }
}

/**
 * Catálogo público: NO requiere autenticación. Expone sólo plantillas
 * publicadas y no privadas, con un shape reducido (sin paramSchema/defaultConfig).
 * Lo consume el landing /automation/pro. Se monta con el mismo `WorkflowTemplatesService`
 * para no duplicar lógica.
 */
@Controller('automation/public')
export class WorkflowPublicController {
  constructor(private templatesService: WorkflowTemplatesService) {}

  @Get('catalog')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async catalog() {
    return this.templatesService.publicCatalog();
  }
}
