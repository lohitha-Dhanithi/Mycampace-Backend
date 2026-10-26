import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdmissionStatus, Prisma } from '../../../generated/prisma-client';

/**
 * Future SPs (PLANNED — consolidated DB phase):
 * edu.sp_admission_create
 * edu.sp_admission_get
 * edu.sp_admission_list
 * edu.sp_admission_update
 * edu.sp_admission_update_status
 * edu.sp_admission_metrics_get
 */
@Injectable()
export class AdmissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, filters?: { institutionId?: string; status?: string }) {
    return this.prisma.admissionApplication.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filters?.institutionId
          ? { institutionId: filters.institutionId }
          : {}),
        ...(filters?.status
          ? { status: filters.status as AdmissionStatus }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        institution: { select: { id: true, name: true, institutionCode: true } },
      },
    });
  }


  findByApplicant(applicantUserId: string, tenantId: string) {
    return this.prisma.admissionApplication.findMany({
      where: { applicantUserId, tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        institution: { select: { id: true, name: true, institutionCode: true } },
      },
    });
  }

  findByIdForApplicant(id: string, applicantUserId: string, tenantId: string) {
    return this.prisma.admissionApplication.findFirst({
      where: { id, applicantUserId, tenantId, deletedAt: null },
      include: {
        institution: { select: { id: true, name: true, institutionCode: true } },
      },
    });
  }

  findById(id: string, tenantId: string) {
    return this.prisma.admissionApplication.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        institution: { select: { id: true, name: true, institutionCode: true } },
      },
    });
  }

  findInstitution(institutionId: string, tenantId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, tenantId, deletedAt: null },
    });
  }

  create(data: Prisma.AdmissionApplicationCreateInput) {
    return this.prisma.admissionApplication.create({
      data,
      include: {
        institution: { select: { id: true, name: true, institutionCode: true } },
      },
    });
  }

  update(id: string, tenantId: string, data: Prisma.AdmissionApplicationUpdateInput) {
    return this.prisma.admissionApplication.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
  }

  async nextApplicationNo(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.admissionApplication.count({
      where: { tenantId },
    });
    return `APP-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  countByStatus(tenantId: string, institutionId?: string) {
    return this.prisma.admissionApplication.groupBy({
      by: ['status'],
      where: {
        tenantId,
        deletedAt: null,
        ...(institutionId ? { institutionId } : {}),
      },
      _count: { _all: true },
    });
  }
}
