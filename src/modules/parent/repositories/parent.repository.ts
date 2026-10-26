import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Parent portal + admin relationship data access.
 * Future SPs (PLANNED):
 * edu.sp_parent_student_relationship_get
 * edu.sp_parent_student_relationship_create
 * edu.sp_parent_portal_students_get
 * edu.sp_parent_portal_admissions_get
 */
@Injectable()
export class ParentRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActiveStudentsForParent(parentUserId: string, tenantId: string) {
    return this.prisma.parentStudentRelationship.findMany({
      where: {
        parentUserId,
        tenantId,
        status: 'ACTIVE',
      },
      include: {
        studentUser: {
          select: {
            id: true,
            email: true,
            personaType: true,
            status: true,
          },
        },
        institution: {
          select: { id: true, name: true, institutionCode: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  findActiveLink(
    parentUserId: string,
    studentUserId: string,
    tenantId: string,
  ) {
    return this.prisma.parentStudentRelationship.findFirst({
      where: {
        parentUserId,
        studentUserId,
        tenantId,
        status: 'ACTIVE',
      },
    });
  }

  listAdmissionsForStudentIds(
    tenantId: string,
    studentUserIds: string[],
    studentUserId?: string,
  ) {
    if (!studentUserIds.length) {
      return Promise.resolve([]);
    }
    const ids = studentUserId
      ? studentUserIds.filter((id) => id === studentUserId)
      : studentUserIds;
    if (!ids.length) {
      return Promise.resolve([]);
    }

    return this.prisma.admissionApplication.findMany({
      where: {
        tenantId,
        deletedAt: null,
        applicantUserId: { in: ids },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        institution: {
          select: { id: true, name: true, institutionCode: true },
        },
      },
    });
  }

  findAdmissionForParent(
    admissionId: string,
    tenantId: string,
    studentUserIds: string[],
  ) {
    return this.prisma.admissionApplication.findFirst({
      where: {
        id: admissionId,
        tenantId,
        deletedAt: null,
        applicantUserId: { in: studentUserIds },
      },
      include: {
        institution: {
          select: { id: true, name: true, institutionCode: true },
        },
      },
    });
  }

  findUserInTenant(userId: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
  }

  findRelationship(
    tenantId: string,
    parentUserId: string,
    studentUserId: string,
  ) {
    return this.prisma.parentStudentRelationship.findFirst({
      where: { tenantId, parentUserId, studentUserId },
    });
  }

  findRelationshipById(id: string, tenantId: string) {
    return this.prisma.parentStudentRelationship.findFirst({
      where: { id, tenantId },
    });
  }

  createRelationship(data: {
    tenantId: string;
    parentUserId: string;
    studentUserId: string;
    relationshipType: string;
    status: string;
    institutionId?: string;
  }) {
    return this.prisma.parentStudentRelationship.create({
      data: {
        relationshipType: data.relationshipType,
        status: data.status,
        tenant: { connect: { id: data.tenantId } },
        parentUser: { connect: { id: data.parentUserId } },
        studentUser: { connect: { id: data.studentUserId } },
        ...(data.institutionId
          ? { institution: { connect: { id: data.institutionId } } }
          : {}),
      },
    });
  }

  updateRelationshipStatus(id: string, tenantId: string, status: string) {
    return this.prisma.parentStudentRelationship.updateMany({
      where: { id, tenantId },
      data: { status },
    });
  }

  listRelationshipsForTenant(tenantId: string) {
    return this.prisma.parentStudentRelationship.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        parentUser: { select: { id: true, email: true } },
        studentUser: { select: { id: true, email: true } },
      },
    });
  }
}
