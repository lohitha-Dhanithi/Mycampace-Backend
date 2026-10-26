import { Injectable } from '@nestjs/common';
import { DepartmentStatus, Prisma } from '../../../generated/prisma-client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DepartmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, institutionId?: string) {
    return this.prisma.department.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(institutionId ? { institutionId } : {}),
      },
      include: {
        institution: { select: { id: true, name: true, institutionCode: true } },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  findById(id: string, tenantId: string) {
    return this.prisma.department.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        institution: { select: { id: true, name: true, institutionCode: true } },
      },
    });
  }

  findByCode(tenantId: string, institutionId: string, code: string) {
    return this.prisma.department.findFirst({
      where: {
        tenantId,
        institutionId,
        code: { equals: code, mode: 'insensitive' },
        deletedAt: null,
      },
    });
  }

  findInstitution(tenantId: string, institutionId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, tenantId, deletedAt: null },
    });
  }

  create(data: Prisma.DepartmentCreateInput) {
    return this.prisma.department.create({
      data,
      include: {
        institution: { select: { id: true, name: true, institutionCode: true } },
      },
    });
  }

  update(id: string, tenantId: string, data: Prisma.DepartmentUpdateInput) {
    return this.prisma.department.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
  }

  softArchive(id: string, tenantId: string) {
    return this.prisma.department.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: {
        status: DepartmentStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });
  }
}
