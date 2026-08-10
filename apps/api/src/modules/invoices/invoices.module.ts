import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InventoryModule } from '../inventory/inventory.module';
import { AfipModule } from '../afip/afip.module';

@Module({
  imports: [InventoryModule, AfipModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
