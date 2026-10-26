import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CampusStatus, Prisma } from '../../../generated/prisma-client';

/** Future: edu.sp_campus_create | edu.sp_campus_get | edu.sp_campus_list — PLANNED */
@Injectable()
export class CampusRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, institutionId?: string) {
    return this.prisma.campus.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(institutionId ? { institutionId } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string, tenantId: string) {
    return this.prisma.campus.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
  }

  findInstitution(institutionId: string, tenantId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, tenantId, deletedAt: null },
    });
  }

  create(data: Prisma.CampusCreateInput) {
    return this.prisma.campus.create({ data });
  }

  update(id: string, tenantId: string, data: Prisma.CampusUpdateInput) {
    return this.prisma.campus.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
  }

  softArchive(id: string, tenantId: string) {
    return this.prisma.campus.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: {
        status: CampusStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });
  }

  listAssignmentsForUser(userId: string, tenantId: string) {
    return this.prisma.userCampusAssignment.findMany({
      where: { userId, tenantId, status: 'ACTIVE' },
      include: {
        campus: true,
      },
    });
  }

  findAssignment(id: string, tenantId: string) {
    return this.prisma.userCampusAssignment.findFirst({
      where: { id, tenantId },
    });
  }

  findActiveAssignment(userId: string, campusId: string, tenantId: string) {
    return this.prisma.userCampusAssignment.findFirst({
      where: { userId, campusId, tenantId, status: 'ACTIVE' },
    });
  }

  createAssignment(data: {
    tenantId: string;
    institutionId: string;
    campusId: string;
    userId: string;
  }) {
    return this.prisma.userCampusAssignment.create({
      data: {
        status: 'ACTIVE',
        tenant: { connect: { id: data.tenantId } },
        institution: { connect: { id: data.institutionId } },
        campus: { connect: { id: data.campusId } },
        user: { connect: { id: data.userId } },
      },
      include: { campus: true },
    });
  }

  updateAssignmentStatus(id: string, tenantId: string, status: string) {
    return this.prisma.userCampusAssignment.updateMany({
      where: { id, tenantId },
      data: { status },
    });
  }

  findUserInTenant(userId: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
  }
}
