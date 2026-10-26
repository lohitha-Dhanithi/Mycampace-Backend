// backend/src/modules/products/products.controller.ts
import { Controller, Get, Post, Param, Body } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { ProductsService } from './products.service'

@ApiTags('Products & Entitlements')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Get full ecosystem product catalog' })
  @ApiResponse({ status: 200, description: 'List of all ecosystem products' })
  async getProducts() {
    return this.productsService.getProducts()
  }

  @Get('entitlements')
  @ApiOperation({ summary: 'Get active product entitlements and subscriptions for organization' })
  @ApiResponse({ status: 200, description: 'Active product licenses and plan limits' })
  async getEntitlements() {
    return this.productsService.getActiveEntitlements('org-1')
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a product for the organization' })
  @ApiResponse({ status: 200, description: 'Product successfully provisioned' })
  async activateProduct(@Param('id') id: string, @Body() body: { plan?: string }) {
    return this.productsService.activateProduct(id, body?.plan)
  }
}
