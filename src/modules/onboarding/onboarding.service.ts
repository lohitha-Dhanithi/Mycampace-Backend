import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { EntitlementStatus, OnboardingStatus, PlatformRole, Prisma } from '@prisma/client'
import { PrismaService } from '@/prisma/prisma.service'
import { ProductCatalogService } from '@/modules/catalog/product-catalog.service'
import {
  InstitutionsSetupDto,
  OrganizationSetupDto,
  ProductSelectionDto,
  TeamInviteDto,
} from './onboarding.dto'

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: ProductCatalogService,
  ) {}

  async getStatus(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        onboardingStatus: true,
        onboardingStep: true,
        branding: true,
        type: true,
      },
    })
    if (!org) throw new NotFoundException('Organization not found.')
    return {
      organizationId: org.id,
      organizationName: org.name,
      status: org.onboardingStatus,
      step: org.onboardingStep,
      required: org.onboardingStatus !== OnboardingStatus.Completed,
    }
  }

  async saveOrganization(organizationId: string, dto: OrganizationSetupDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { onboardingStep: true },
    })
    if (!existing) throw new NotFoundException('Organization not found.')

    const base =
      dto.name
        .trim()
        .split(/\s+/)
        .map((word) => word[0] || '')
        .join('')
        .slice(0, 6)
        .toUpperCase() || 'ORG'
    // Organization.code is unique: keep the readable initials unless another organization already has them.
    const taken = await this.prisma.organization.findFirst({
      where: { code: base, NOT: { id: organizationId } },
      select: { id: true },
    })
    const code = taken ? `${base}-${randomBytes(2).toString('hex').toUpperCase()}` : base

    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: dto.name.trim(),
        legalName: dto.legalName?.trim(),
        type: dto.type,
        country: dto.country,
        state: dto.state,
        city: dto.city,
        address: dto.address,
        postalCode: dto.postalCode,
        taxId: dto.taxId,
        domains: dto.domains || [],
        branding: dto.branding as Prisma.InputJsonValue,
        primaryContact: dto.primaryContact as Prisma.InputJsonValue,
        code,
        onboardingStatus: OnboardingStatus.InProgress,
        onboardingStep: Math.max(existing.onboardingStep, 2),
      },
    })
    return { organization: org, nextStep: org.onboardingStep, nextRoute: '/onboarding/institutions' }
  }

  async saveInstitutions(organizationId: string, dto: InstitutionsSetupDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { onboardingStep: true },
    })
    if (!existing) throw new NotFoundException('Organization not found.')

    const institutions = await this.prisma.$transaction(async (tx) => {
      await tx.campus.deleteMany({
        where: { institution: { organizationId } },
      })
      await tx.institution.deleteMany({ where: { organizationId } })

      const createdInstitutions = []
      for (const inst of dto.institutions) {
        const row = await tx.institution.create({
          data: {
            organizationId,
            name: inst.name,
            code: inst.code,
            type: inst.type,
            affiliation: inst.affiliation,
            email: inst.email,
            phone: inst.phone,
          },
        })
        createdInstitutions.push(row)
      }

      const codeToId = new Map(createdInstitutions.map((i) => [i.code, i.id]))
      const createdCampuses = []
      for (const campus of dto.campuses) {
        const institutionId = codeToId.get(campus.institutionCode)
        if (!institutionId) {
          throw new BadRequestException(
            `Unknown institution code "${campus.institutionCode}" for campus ${campus.name}.`,
          )
        }
        const row = await tx.campus.create({
          data: {
            institutionId,
            name: campus.name,
            code: campus.code,
            city: campus.city || 'TBD',
            address: campus.address,
          },
        })
        createdCampuses.push(row)
      }

      await tx.organization.update({
        where: { id: organizationId },
        data: { onboardingStep: Math.max(existing.onboardingStep, 3) },
      })

      return { institutions: createdInstitutions, campuses: createdCampuses }
    })

    const step = Math.max(existing.onboardingStep, 3)
    return { ...institutions, nextStep: step, nextRoute: '/onboarding/products' }
  }

  async saveProducts(organizationId: string, dto: ProductSelectionDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { onboardingStep: true },
    })
    if (!existing) throw new NotFoundException('Organization not found.')

    await this.catalog.ensureCatalog()
    const allowed = new Set(this.catalog.listIds())
    const invalid = dto.productIds.filter((id) => !allowed.has(id))
    if (invalid.length) {
      throw new BadRequestException(`Unknown product ids: ${invalid.join(', ')}`)
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productEntitlement.deleteMany({ where: { organizationId } })
      for (const productId of dto.productIds) {
        await tx.productEntitlement.create({
          data: {
            organizationId,
            productId,
            status: EntitlementStatus.Active,
            plan: 'Professional',
          },
        })
      }
      await tx.organization.update({
        where: { id: organizationId },
        data: { onboardingStep: Math.max(existing.onboardingStep, 4) },
      })
    })

    const step = Math.max(existing.onboardingStep, 4)
    return { productIds: dto.productIds, nextStep: step, nextRoute: '/onboarding/team' }
  }

  async saveTeamInvites(organizationId: string, dto: TeamInviteDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { onboardingStep: true },
    })
    if (!existing) throw new NotFoundException('Organization not found.')

    await this.prisma.$transaction(async (tx) => {
      await tx.teamInvite.deleteMany({ where: { organizationId } })
      for (const invite of dto.invites) {
        await tx.teamInvite.create({
          data: {
            organizationId,
            email: invite.email.toLowerCase(),
            name: invite.name,
            jobTitle: invite.jobTitle,
            platformRole: PlatformRole.Member,
            productRoles: (invite.productRoles || {}) as Prisma.InputJsonValue,
            status: 'pending',
          },
        })
      }
      await tx.organization.update({
        where: { id: organizationId },
        data: { onboardingStep: Math.max(existing.onboardingStep, 5) },
      })
    })
    const step = Math.max(existing.onboardingStep, 5)
    return { count: dto.invites.length, nextStep: step, nextRoute: '/onboarding/products/confirmation' }
  }

  async complete(organizationId: string) {
    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        onboardingStatus: OnboardingStatus.Completed,
        onboardingStep: 5,
      },
    })
    return {
      organizationId: org.id,
      status: org.onboardingStatus,
      completed: true,
      nextRoute: '/app',
    }
  }
}
