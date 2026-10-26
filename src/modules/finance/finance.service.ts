// backend/src/modules/finance/finance.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { RedisCacheService } from '@/cache/redis-cache.service'

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async getFeeStructures() {
    return [
      { id: 'fee-1', name: 'Grade 11 Science (CBSE) 2026-27', totalAmount: 145000, currency: 'INR', componentsCount: 5 },
      { id: 'fee-2', name: 'Grade 10 General Term 1 & 2', totalAmount: 95000, currency: 'INR', componentsCount: 4 },
      { id: 'fee-3', name: 'B.Tech CSE Year 1 Annual Fee', totalAmount: 220000, currency: 'INR', componentsCount: 6 },
    ]
  }

  async getRecentInvoices() {
    return [
      { id: 'inv-1', invoiceNo: 'INV-2026-081', studentName: 'Tanya Patel', studentId: 'STU-8921', amount: 45000, status: 'Paid', date: '2026-10-04' },
      { id: 'inv-2', invoiceNo: 'INV-2026-082', studentName: 'Rohan Sharma', studentId: 'STU-8922', amount: 45000, status: 'Unpaid', date: '2026-10-02' },
    ]
  }

  async getDhanitiPayStatus() {
    return {
      status: 'Active',
      gateway: 'DhanitiPay Enterprise',
      merchantId: 'MERC-MYCAMPACE-HYD-991',
      settlementCycle: 'T+1 Working Days',
      supportedModes: ['UPI', 'NetBanking', 'Credit/Debit Card', 'Education Loan EMI'],
    }
  }
}
