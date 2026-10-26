import { Injectable } from '@nestjs/common';
import { AcademicYearStatus, Prisma } from '../../../generated/prisma-client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AcademicYearRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, institutionId?: string) {
    return this.prisma.academicYear.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(institutionId ? { institutionId } : {}),
      },
      include: {
        institution: {
          select: {
            id: true,
            name: true,
            institutionCode: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: [{ startDate: 'desc' }, { code: 'desc' }],
    });
  }

  findById(id: string, tenantId: string) {
    return this.prisma.academicYear.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        institution: {
          select: {
            id: true,
            name: true,
            institutionCode: true,
            city: true,
            state: true,
          },
        },
      },
    });
  }

  findByCode(tenantId: string, institutionId: string, code: string) {
    return this.prisma.academicYear.findFirst({
      where: { tenantId, institutionId, code, deletedAt: null },
    });
  }

  findInstitution(tenantId: string, institutionId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, tenantId, deletedAt: null },
    });
  }

  create(data: Prisma.AcademicYearCreateInput) {
    return this.prisma.academicYear.create({
      data,
      include: {
        institution: {
          select: {
            id: true,
            name: true,
            institutionCode: true,
            city: true,
            state: true,
          },
        },
      },
    });
  }

  update(id: string, tenantId: string, data: Prisma.AcademicYearUpdateInput) {
    return this.prisma.academicYear.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
  }

  async setActiveExclusive(
    tenantId: string,
    institutionId: string,
    academicYearId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: {
          tenantId,
          institutionId,
          deletedAt: null,
          status: AcademicYearStatus.ACTIVE,
          NOT: { id: academicYearId },
        },
        data: { status: AcademicYearStatus.INACTIVE },
      });
      await tx.academicYear.updateMany({
        where: { id: academicYearId, tenantId, deletedAt: null },
        data: { status: AcademicYearStatus.ACTIVE },
      });
      return tx.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
        include: {
          institution: {
            select: {
              id: true,
              name: true,
              institutionCode: true,
              city: true,
              state: true,
            },
          },
        },
      });
    });
  }

  softArchive(id: string, tenantId: string) {
    return this.prisma.academicYear.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: {
        status: AcademicYearStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });
  }
}
