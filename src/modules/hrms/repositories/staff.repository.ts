import { Injectable } from '@nestjs/common';
import { Prisma, StaffStatus } from '../../../generated/prisma-client';
import { PrismaService } from '../../../prisma/prisma.service';

export const STAFF_INCLUDE = {
  category: { select: { id: true, name: true, isTeaching: true } },
  department: { select: { id: true, name: true } },
  campus: { select: { id: true, name: true, code: true } },
  reportingManager: { select: { id: true, fullName: true } },
} satisfies Prisma.StaffInclude;

export interface StaffListFilters {
  search?: string;
  categoryId?: string;
  status?: StaffStatus;
  campusId?: string;
  departmentId?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, f: StaffListFilters) {
    const q = f.search?.trim();
    const where: Prisma.StaffWhereInput = {
      tenantId,
      deletedAt: null,
      ...(f.categoryId ? { categoryId: f.categoryId } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.campusId ? { campusId: f.campusId } : {}),
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { employeeCode: { contains: q, mode: 'insensitive' } },
              { designation: { contains: q, mode: 'insensitive' } },
              { department: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.staff.findMany({
        where,
        include: STAFF_INCLUDE,
        orderBy: [{ fullName: 'asc' }],
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
      this.prisma.staff.count({ where }),
    ]);
    return { rows, total };
  }

  findById(id: string, tenantId: string) {
    return this.prisma.staff.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: STAFF_INCLUDE,
    });
  }

  /** Resolve the staff record for a logged-in platform user: explicit link first, then email. */
  findByUser(userId: string, email: string, tenantId: string) {
    return this.prisma.staff.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ userId }, { email: { equals: email, mode: 'insensitive' } }],
      },
      include: STAFF_INCLUDE,
    });
  }

  findByEmail(tenantId: string, email: string) {
    return this.prisma.staff.findFirst({
      where: { tenantId, deletedAt: null, email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
  }

  findCampus(id: string, tenantId: string) {
    return this.prisma.campus.findFirst({ where: { id, tenantId, deletedAt: null } });
  }
  findCategory(id: string, tenantId: string) {
    return this.prisma.hrmsCategory.findFirst({ where: { id, tenantId, deletedAt: null } });
  }
  findDepartment(id: string, tenantId: string) {
    return this.prisma.hrmsDepartment.findFirst({ where: { id, tenantId, deletedAt: null } });
  }
  findUser(id: string, tenantId: string) {
    return this.prisma.user.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
  }

  /** Highest numeric suffix among EMP-#### codes for the tenant. */
  async maxEmployeeNumber(tenantId: string): Promise<number> {
    const rows = await this.prisma.staff.findMany({
      where: { tenantId, employeeCode: { startsWith: 'EMP-' } },
      select: { employeeCode: true },
    });
    return rows.reduce((max, r) => Math.max(max, Number(r.employeeCode.replace(/\D/g, '')) || 0), 0);
  }

  /** Staff + joining service event, created atomically. */
  createWithJoinEvent(data: Prisma.StaffUncheckedCreateInput, createdById: string) {
    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.create({ data, include: STAFF_INCLUDE });
      await tx.serviceEvent.create({
        data: {
          tenantId: data.tenantId,
          staffId: staff.id,
          eventDate: data.joiningDate as Date,
          title: 'Joined the institution',
          detail: `${data.designation} · ${staff.department.name} · ${staff.campus.name}`,
          createdById,
        },
      });
      return staff;
    });
  }

  update(id: string, tenantId: string, data: Prisma.StaffUncheckedUpdateManyInput) {
    return this.prisma.staff.updateMany({ where: { id, tenantId, deletedAt: null }, data });
  }

  // ---- Profile aggregates ----
  documents(staffId: string, tenantId: string) {
    return this.prisma.staffDocument.findMany({
      where: { staffId, tenantId, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
    });
  }
  serviceEvents(staffId: string, tenantId: string) {
    return this.prisma.serviceEvent.findMany({
      where: { staffId, tenantId },
      orderBy: { eventDate: 'desc' },
    });
  }
  certifications(staffId: string, tenantId: string) {
    return this.prisma.certification.findMany({
      where: { staffId, tenantId, deletedAt: null },
      orderBy: { validUntil: 'asc' },
    });
  }

  createDocument(data: Prisma.StaffDocumentUncheckedCreateInput) {
    return this.prisma.staffDocument.create({ data });
  }
  findDocument(id: string, tenantId: string) {
    return this.prisma.staffDocument.findFirst({ where: { id, tenantId, deletedAt: null } });
  }
  updateDocument(id: string, tenantId: string, data: Prisma.StaffDocumentUpdateInput) {
    return this.prisma.staffDocument.updateMany({ where: { id, tenantId, deletedAt: null }, data });
  }
  createServiceEvent(data: Prisma.ServiceEventUncheckedCreateInput) {
    return this.prisma.serviceEvent.create({ data });
  }
  createCertification(data: Prisma.CertificationUncheckedCreateInput) {
    return this.prisma.certification.create({ data });
  }
}
