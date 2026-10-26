import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma-client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class HrmsSetupRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Categories ----
  listCategories(tenantId: string) {
    return this.prisma.hrmsCategory.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }
  findCategory(id: string, tenantId: string) {
    return this.prisma.hrmsCategory.findFirst({ where: { id, tenantId, deletedAt: null } });
  }
  findCategoryByName(tenantId: string, name: string) {
    return this.prisma.hrmsCategory.findFirst({
      where: { tenantId, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
    });
  }
  createCategory(data: Prisma.HrmsCategoryUncheckedCreateInput) {
    return this.prisma.hrmsCategory.create({ data });
  }
  updateCategory(id: string, tenantId: string, data: Prisma.HrmsCategoryUpdateInput) {
    return this.prisma.hrmsCategory.updateMany({ where: { id, tenantId, deletedAt: null }, data });
  }

  // ---- Departments ----
  listDepartments(tenantId: string) {
    return this.prisma.hrmsDepartment.findMany({
      where: { tenantId, deletedAt: null },
      include: { head: { select: { id: true, fullName: true } } },
      orderBy: { name: 'asc' },
    });
  }
  findDepartment(id: string, tenantId: string) {
    return this.prisma.hrmsDepartment.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { head: { select: { id: true, fullName: true } } },
    });
  }
  findDepartmentByName(tenantId: string, name: string) {
    return this.prisma.hrmsDepartment.findFirst({
      where: { tenantId, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
    });
  }
  createDepartment(data: Prisma.HrmsDepartmentUncheckedCreateInput) {
    return this.prisma.hrmsDepartment.create({
      data,
      include: { head: { select: { id: true, fullName: true } } },
    });
  }
  updateDepartment(id: string, tenantId: string, data: Prisma.HrmsDepartmentUncheckedUpdateManyInput) {
    return this.prisma.hrmsDepartment.updateMany({ where: { id, tenantId, deletedAt: null }, data });
  }
  findStaffInTenant(id: string, tenantId: string) {
    return this.prisma.staff.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
  }
  findAcademicDepartment(id: string, tenantId: string) {
    return this.prisma.department.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
  }

  // ---- Leave types ----
  listLeaveTypes(tenantId: string) {
    return this.prisma.leaveType.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }
  findLeaveType(id: string, tenantId: string) {
    return this.prisma.leaveType.findFirst({ where: { id, tenantId } });
  }
  findLeaveTypeByCode(tenantId: string, code: string) {
    return this.prisma.leaveType.findFirst({
      where: { tenantId, code: { equals: code, mode: 'insensitive' } },
    });
  }
  createLeaveType(data: Prisma.LeaveTypeUncheckedCreateInput) {
    return this.prisma.leaveType.create({ data });
  }
  updateLeaveType(id: string, tenantId: string, data: Prisma.LeaveTypeUpdateInput) {
    return this.prisma.leaveType.updateMany({ where: { id, tenantId }, data });
  }

  // ---- Appraisal metric templates ----
  listMetricTemplates(tenantId: string, categoryId: string) {
    return this.prisma.appraisalMetricTemplate.findMany({
      where: { tenantId, categoryId },
      orderBy: { sortOrder: 'asc' },
    });
  }
  replaceMetricTemplates(
    tenantId: string,
    categoryId: string,
    metrics: { name: string; weight: number }[],
  ) {
    return this.prisma.$transaction([
      this.prisma.appraisalMetricTemplate.deleteMany({ where: { tenantId, categoryId } }),
      this.prisma.appraisalMetricTemplate.createMany({
        data: metrics.map((m, i) => ({ tenantId, categoryId, name: m.name, weight: m.weight, sortOrder: i })),
      }),
    ]);
  }
}
