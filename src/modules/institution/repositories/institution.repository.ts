import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InstitutionStatus, Prisma } from '../../../generated/prisma-client';

/**
 * Future: edu.sp_institution_get|get_by_id|create|update|archive|metrics_get
 * Status: PLANNED — consolidated DB phase
 */
@Injectable()
export class InstitutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByTenant(tenantId: string) {
    return this.prisma.institution.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  findByIdForTenant(id: string, tenantId: string) {
    return this.prisma.institution.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
  }

  findByCodeForTenant(institutionCode: string, tenantId: string) {
    return this.prisma.institution.findFirst({
      where: { institutionCode, tenantId, deletedAt: null },
    });
  }

  create(data: Prisma.InstitutionCreateInput) {
    return this.prisma.institution.create({ data });
  }

  update(id: string, tenantId: string, data: Prisma.InstitutionUpdateInput) {
    return this.prisma.institution.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
  }

  archive(id: string, tenantId: string) {
    return this.prisma.institution.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: {
        status: InstitutionStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Metrics from real tables only.
   * applications = count of admission_applications for this institution.
   * students/teachers remain 0 until SIS modules exist — do not invent.
   */
  async metricsForInstitution(institutionId: string, tenantId: string) {
    const applications = await this.prisma.admissionApplication.count({
      where: { institutionId, tenantId, deletedAt: null },
    });
    return {
      students: 0,
      teachers: 0,
      applications,
    };
  }
}
