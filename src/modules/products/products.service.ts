// backend/src/modules/products/products.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { RedisCacheService } from '@/cache/redis-cache.service'

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  private defaultProducts = [
    {
      id: 'academics',
      name: 'Academics',
      fullName: 'MyCampace Academics',
      category: 'core-academic',
      tagline: 'Academic structures, classes, curricula & faculty workload',
      plan: 'Professional',
      status: 'Active',
      modulesCount: 12,
      route: '/app/academics',
    },
    {
      id: 'lms',
      name: 'LMS',
      fullName: 'MyCampace LMS',
      category: 'core-academic',
      tagline: 'Modern digital learning, multimedia lessons & assessments',
      plan: 'Professional',
      status: 'Active',
      modulesCount: 8,
      route: '/app/lms',
    },
    {
      id: 'finance',
      name: 'Finance',
      fullName: 'MyCampace Finance',
      category: 'finance-admin',
      tagline: 'Fee structures, collections, reconciliation & institutional finance',
      plan: 'Professional',
      status: 'Active',
      modulesCount: 14,
      route: '/app/finance',
    },
    {
      id: 'admissions',
      name: 'Admissions',
      fullName: 'MyCampace Admissions',
      category: 'core-academic',
      tagline: 'End-to-end recruitment funnel, counselling & digital applications',
      plan: 'Professional',
      status: 'Active',
      modulesCount: 7,
      route: '/app/admissions',
    },
    {
      id: 'hrms',
      name: 'HRMS',
      fullName: 'MyCampace HRMS',
      category: 'finance-admin',
      tagline: 'Employee records, leave policies, onboarding & performance',
      plan: 'Professional',
      status: 'Trial',
      modulesCount: 7,
      route: '/app/hrms',
    },
  ]

  async getProducts() {
    return this.defaultProducts
  }

  async getActiveEntitlements(orgId: string) {
    return [
      { productId: 'academics', status: 'Active', plan: 'Enterprise Platform' },
      { productId: 'lms', status: 'Active', plan: 'Professional' },
      { productId: 'finance', status: 'Active', plan: 'Professional Suite' },
      { productId: 'admissions', status: 'Active', plan: 'Growth CRM' },
      { productId: 'hrms', status: 'Trial', plan: '14-Day Free Trial' },
    ]
  }

  async activateProduct(productId: string, plan = 'Professional') {
    // Invalidate cache
    await this.cache.del(`entitlements:org-1`)
    return {
      productId,
      status: 'Active',
      plan,
      activatedAt: new Date().toISOString(),
    }
  }
}
