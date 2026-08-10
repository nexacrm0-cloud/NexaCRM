import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { InventorySearchController } from './inventory-search.controller';
import { InventorySearchService } from './inventory-search.service';

@Module({
  controllers: [ProductsController, StockController, InventorySearchController],
  providers: [ProductsService, StockService, InventorySearchService],
  exports: [ProductsService, StockService, InventorySearchService],
})
export class InventoryModule {}
