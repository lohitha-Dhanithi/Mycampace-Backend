import { Injectable } from '@nestjs/common';
import { AppraisalStage, Prisma } from '../../../generated/prisma-client';
import { PrismaService } from '../../../prisma/prisma.service';

export const REVIEW_INCLUDE = {
  staff: {
    select: {
      id: true,
      fullName: true,
      designation: true,
      reportingManagerId: true,
      department: { select: { id: true, name: true, headStaffId: true } },
      category: { select: { id: true, name: true } },
    },
  },
  cycle: { select: { id: true, name: true } },
  metrics: { orderBy: { sortOrder: 'asc' } },
  comments: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.AppraisalReviewInclude;

@Injectable()
export class AppraisalRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  listCycles(tenantId: string) {
    return this.prisma.appraisalCycle.findMany({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { reviews: true } } },
    });
  }
  findCycle(id: string, tenantId: string) {
    return this.prisma.appraisalCycle.findFirst({ where: { id, tenantId } });
  }
  findCycleByName(tenantId: string, name: string) {
    return this.prisma.appraisalCycle.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
  }
  openCycle(tenantId: string) {
    return this.prisma.appraisalCycle.findFirst({
      where: { tenantId, isOpen: true },
      orderBy: { startDate: 'desc' },
    });
  }
  createCycle(data: Prisma.AppraisalCycleUncheckedCreateInput) {
    return this.prisma.appraisalCycle.create({ data });
  }
  setCycleOpen(id: string, tenantId: string, isOpen: boolean) {
    return this.prisma.appraisalCycle.updateMany({ where: { id, tenantId }, data: { isOpen } });
  }

  /** Staff in the tenant who do not yet have a review for the cycle. */
  staffWithoutReview(tenantId: string, cycleId: string) {
    return this.prisma.staff.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { not: 'SEPARATED' },
        appraisals: { none: { cycleId } },
      },
      select: { id: true, categoryId: true },
    });
  }
  templatesFor(tenantId: string) {
    return this.prisma.appraisalMetricTemplate.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  list(tenantId: string, f: { cycleId?: string; stage?: AppraisalStage; staffId?: string }) {
    return this.prisma.appraisalReview.findMany({
      where: {
        tenantId,
        ...(f.cycleId ? { cycleId: f.cycleId } : {}),
        ...(f.stage ? { stage: f.stage } : {}),
        ...(f.staffId ? { staffId: f.staffId } : {}),
      },
      include: REVIEW_INCLUDE,
      orderBy: { staff: { fullName: 'asc' } },
    });
  }
  findById(id: string, tenantId: string) {
    return this.prisma.appraisalReview.findFirst({ where: { id, tenantId }, include: REVIEW_INCLUDE });
  }
  findStaffByUser(userId: string, email: string, tenantId: string) {
    return this.prisma.staff.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ userId }, { email: { equals: email, mode: 'insensitive' } }],
      },
      select: { id: true },
    });
  }
}
