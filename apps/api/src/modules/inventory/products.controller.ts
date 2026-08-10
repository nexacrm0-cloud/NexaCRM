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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import {
  UserRole,
  createProductCategorySchema,
  createProductSchema,
  updateProductSchema,
  addProductVariantSchema,
  productsQuerySchema,
  idParamSchema,
} from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('inventory/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('categories')
  async listCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.productsService.listCategories(user.organizationId);
  }

  @Get('dashboard')
  async dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.productsService.dashboard(user.organizationId);
  }

  @Post('categories')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(createProductCategorySchema)) body: { name: string; color?: string },
  ) {
    return this.productsService.createCategory(user.organizationId, body.name, body.color);
  }

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodPipe(productsQuerySchema))
    query: {
      page: number;
      limit: number;
      search?: string;
      categoryId?: string;
      status?: 'all' | 'active' | 'lowStock';
    },
  ) {
    return this.productsService.findAll(user.organizationId, query);
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
  ) {
    return this.productsService.findOne(user.organizationId, params.id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(createProductSchema)) body: Parameters<ProductsService['create']>[1],
  ) {
    return this.productsService.create(user.organizationId, body, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @Body(new ZodPipe(updateProductSchema)) body: Parameters<ProductsService['update']>[2],
  ) {
    return this.productsService.update(user.organizationId, params.id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
  ) {
    await this.productsService.remove(user.organizationId, params.id);
    return { success: true };
  }

  @Post(':id/variants')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async addVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @Body(new ZodPipe(addProductVariantSchema)) body: Parameters<ProductsService['addVariant']>[2],
  ) {
    return this.productsService.addVariant(user.organizationId, params.id, body, user.id);
  }

  @Delete(':id/variants/:variantId')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async removeVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') productId: string,
    @Param('variantId') variantId: string,
  ) {
    await this.productsService.removeVariant(user.organizationId, productId, variantId);
    return { success: true };
  }
}
