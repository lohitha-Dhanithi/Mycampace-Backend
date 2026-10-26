// backend/src/modules/organization/organization.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { RedisCacheService } from '@/cache/redis-cache.service'

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async getOrganizationProfile() {
    const cached = await this.cache.get('org:profile')
    if (cached) return cached

    const profile = {
      id: 'org-1',
      name: 'Apex Global Education Foundation',
      code: 'AGEF',
      type: 'Higher Education & K-12 Group',
      country: 'India',
      state: 'Telangana',
      city: 'Hyderabad',
      domains: ['apexeducation.org', 'abcschool.edu.in', 'aitm.edu.in'],
      academicContext: {
        currentYear: '2026-27',
        activeTerm: 'Fall Term',
      },
    }

    await this.cache.set('org:profile', profile, 3600)
    return profile
  }

  async getInstitutions() {
    return [
      {
        id: 'inst-1',
        name: 'ABC International School',
        code: 'ABC-INTL',
        type: 'K-12 School',
        affiliation: 'CBSE',
        status: 'Active',
      },
      {
        id: 'inst-2',
        name: 'Apex Institute of Technology & Management',
        code: 'AITM',
        type: 'Higher Education / University',
        affiliation: 'JNTU / AICTE Approved',
        status: 'Active',
      },
    ]
  }

  async getCampuses() {
    return [
      {
        id: 'camp-1',
        institutionId: 'inst-1',
        name: 'Hyderabad Main Campus',
        code: 'HYD-MAIN',
        city: 'Hyderabad',
        status: 'Active',
      },
      {
        id: 'camp-2',
        institutionId: 'inst-1',
        name: 'Gachibowli City Campus',
        code: 'HYD-GCB',
        city: 'Hyderabad',
        status: 'Active',
      },
    ]
  }
}
