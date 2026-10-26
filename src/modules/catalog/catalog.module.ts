import { Global, Module } from '@nestjs/common'
import { ProductCatalogService } from './product-catalog.service'

@Global()
@Module({
  providers: [ProductCatalogService],
  exports: [ProductCatalogService],
})
export class CatalogModule {}
