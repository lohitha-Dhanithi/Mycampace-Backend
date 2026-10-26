// backend/src/modules/finance/finance.controller.ts
import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { FinanceService } from './finance.service'

@ApiTags('Finance')
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('fee-structures')
  @ApiOperation({ summary: 'Get institutional fee structures and breakdown' })
  @ApiResponse({ status: 200, description: 'List of fee structures' })
  async getFeeStructures() {
    return this.financeService.getFeeStructures()
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Get recent invoices and payment transactions' })
  @ApiResponse({ status: 200, description: 'List of invoices' })
  async getInvoices() {
    return this.financeService.getRecentInvoices()
  }

  @Get('dhanitipay')
  @ApiOperation({ summary: 'Get DhanitiPay financial services integration status' })
  @ApiResponse({ status: 200, description: 'Payment gateway and lending status' })
  async getDhanitiPay() {
    return this.financeService.getDhanitiPayStatus()
  }
}
