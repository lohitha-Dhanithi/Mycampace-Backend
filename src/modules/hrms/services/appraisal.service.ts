import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppraisalStage, Prisma } from '../../../generated/prisma-client';
import { AppraisalRepository, REVIEW_INCLUDE } from '../repositories/appraisal.repository';
import { AuditService } from '../../audit/services/audit.service';
import { AuthorizationService } from '../../identity/services/authorization.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import { AdvanceAppraisalDto, CreateAppraisalCycleDto, ScoreMetricDto } from '../dto/attendance-appraisal.dto';
import { isoDate, parseDate, ratingFor, round1 } from '../common/hrms.util';

type ReviewRow = Prisma.AppraisalReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;
type ScoreField = 'selfScore' | 'hodScore' | 'principalScore';

const STAGE_FIELD: Record<Exclude<AppraisalStage, 'HR_CLOSED'>, ScoreField> = {
  SELF_REVIEW: 'selfScore',
  HOD_REVIEW: 'hodScore',
  PRINCIPAL_REVIEW: 'principalScore',
};

@Injectable()
export class AppraisalService {
  constructor(
    private readonly repo: AppraisalRepository,
    private readonly audit: AuditService,
    private readonly authz: AuthorizationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Cycles
  // ---------------------------------------------------------------------------

  listCycles(auth: AuthContext) {
    return this.repo.listCycles(auth.tenantId);
  }

  /** Create a cycle and open a review (with metric snapshot) for every active staff member. */
  async createCycle(auth: AuthContext, dto: CreateAppraisalCycleDto) {
    const start = parseDate(dto.startDate);
    const end = parseDate(dto.endDate);
    if (end < start) {
      throw new BadRequestException({ code: 'HRMS_CYCLE_RANGE_INVALID', message: 'End date must be on or after start date.' });
    }
    if (await this.repo.findCycleByName(auth.tenantId, dto.name.trim())) {
      throw new ConflictException({ code: 'HRMS_CYCLE_EXISTS', message: 'An appraisal cycle with this name already exists.' });
    }
    const cycle = await this.repo.createCycle({
      tenantId: auth.tenantId,
      name: dto.name.trim(),
      academicYearId: dto.academicYearId,
      startDate: start,
      endDate: end,
    });
    const enrolled = await this.enrolAll(auth.tenantId, cycle.id);
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'hrms.appraisal_cycle.create',
      module: 'hrms',
      entityType: 'AppraisalCycle',
      entityId: cycle.id,
      metadata: { enrolled },
    });
    return { ...cycle, enrolled };
  }

  async closeCycle(auth: AuthContext, id: string) {
    if (!(await this.repo.findCycle(id, auth.tenantId))) {
      throw new NotFoundException({ code: 'HRMS_CYCLE_NOT_FOUND', message: 'Appraisal cycle not found.' });
    }
    await this.repo.setCycleOpen(id, auth.tenantId, false);
    return { message: 'Cycle closed.' };
  }

  /** Called when a staff member is hired mid-cycle. No-op when no cycle is open. */
  async enrolInOpenCycle(tenantId: string, staffId: string, categoryId: string) {
    const cycle = await this.repo.openCycle(tenantId);
    if (!cycle) return;
    const templates = (await this.repo.templatesFor(tenantId)).filter((t) => t.categoryId === categoryId);
    await this.repo.transaction((tx) => this.createReview(tx, tenantId, cycle.id, staffId, templates));
  }

  private async enrolAll(tenantId: string, cycleId: string) {
    const [staff, templates] = await Promise.all([
      this.repo.staffWithoutReview(tenantId, cycleId),
      this.repo.templatesFor(tenantId),
    ]);
    await this.repo.transaction(async (tx) => {
      for (const s of staff) {
        await this.createReview(tx, tenantId, cycleId, s.id, templates.filter((t) => t.categoryId === s.categoryId));
      }
    });
    return staff.length;
  }

  private createReview(
    tx: Prisma.TransactionClient,
    tenantId: string,
    cycleId: string,
    staffId: string,
    templates: { name: string; weight: number; sortOrder: number }[],
  ) {
    return tx.appraisalReview.create({
      data: {
        tenantId,
        cycleId,
        staffId,
        metrics: {
          create: templates.map((t) => ({
            tenantId,
            name: t.name,
            weight: t.weight,
            sortOrder: t.sortOrder,
          })),
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async list(auth: AuthContext, q: { cycleId?: string; stage?: AppraisalStage }) {
    const rows = await this.repo.list(auth.tenantId, q);
    return rows.map((r) => this.toDto(r));
  }

  async listForStaff(auth: AuthContext, staffId: string) {
    const rows = await this.repo.list(auth.tenantId, { staffId });
    return rows.map((r) => this.toDto(r));
  }

  async listMine(auth: AuthContext) {
    const me = await this.requireMe(auth);
    return this.listForStaff(auth, me.id);
  }

  /** Reviews waiting on this person as HOD / reporting manager. */
  async assignedToMe(auth: AuthContext) {
    const me = await this.requireMe(auth);
    const rows = await this.repo.list(auth.tenantId, { stage: 'HOD_REVIEW' });
    return rows
      .filter(
        (r) =>
          r.staffId !== me.id &&
          (r.staff.department.headStaffId === me.id || r.staff.reportingManagerId === me.id),
      )
      .map((r) => this.toDto(r));
  }

  async get(auth: AuthContext, id: string) {
    const review = await this.findOrThrow(auth.tenantId, id);
    if (!(await this.authz.hasPermission(auth.userId, auth.tenantId, 'hrms.appraisal.read'))) {
      const me = await this.requireMe(auth);
      if (!this.isParticipant(review, me.id)) throw this.denied();
    }
    return this.toDto(review);
  }

  // ---------------------------------------------------------------------------
  // Scoring and stage transitions
  // ---------------------------------------------------------------------------

  async scoreMetric(auth: AuthContext, reviewId: string, metricId: string, dto: ScoreMetricDto) {
    const review = await this.findOrThrow(auth.tenantId, reviewId);
    this.assertOpen(review);
    await this.assertActorForStage(auth, review);
    const metric = review.metrics.find((m) => m.id === metricId);
    if (!metric) throw new NotFoundException({ code: 'HRMS_METRIC_NOT_FOUND', message: 'Metric not found on this review.' });

    const field = this.metricField(review.stage);
    await this.repo.transaction((tx) =>
      tx.appraisalReviewMetric.update({ where: { id: metricId }, data: { [field]: dto.score } }),
    );
    return this.get(auth, reviewId);
  }

  /** Submit the current stage. Moves Self → HOD → Principal → HR Closed and computes the final rating. */
  async advance(auth: AuthContext, id: string, dto: AdvanceAppraisalDto) {
    const review = await this.findOrThrow(auth.tenantId, id);
    this.assertOpen(review);
    await this.assertActorForStage(auth, review);

    const metricField = this.metricField(review.stage);
    if (review.metrics.length === 0) {
      throw new BadRequestException({ code: 'HRMS_NO_METRICS', message: 'No metrics are configured for this review. Set up metric templates first.' });
    }
    if (review.metrics.some((m) => !m[metricField])) {
      throw new BadRequestException({ code: 'HRMS_METRICS_INCOMPLETE', message: 'Score every metric from 1 to 5 before moving the review forward.' });
    }
    const totalWeight = review.metrics.reduce((s, m) => s + m.weight, 0) || 1;
    const score = round1(review.metrics.reduce((s, m) => s + (m[metricField] as number) * m.weight, 0) / totalWeight);
    const stage = review.stage as Exclude<AppraisalStage, 'HR_CLOSED'>;

    const data: Prisma.AppraisalReviewUncheckedUpdateInput = { [STAGE_FIELD[stage]]: score };
    if (stage === 'SELF_REVIEW') data.stage = 'HOD_REVIEW';
    else if (stage === 'HOD_REVIEW') data.stage = 'PRINCIPAL_REVIEW';
    else {
      const finalScore = round1((Number(review.selfScore ?? 0) + Number(review.hodScore ?? 0) + score) / 3);
      data.stage = 'HR_CLOSED';
      data.finalScore = finalScore;
      data.finalRating = ratingFor(finalScore);
      data.closedAt = new Date();
      data.closedById = auth.userId;
    }

    await this.repo.transaction(async (tx) => {
      // Guard against two actors advancing the same stage at once
      const moved = await tx.appraisalReview.updateMany({
        where: { id, tenantId: auth.tenantId, stage: review.stage },
        data: data as Prisma.AppraisalReviewUncheckedUpdateManyInput,
      });
      if (moved.count !== 1) {
        throw new ConflictException({ code: 'HRMS_APPRAISAL_STAGE_CHANGED', message: 'This review was already advanced. Refresh and retry.' });
      }
      await tx.appraisalComment.create({
        data: {
          tenantId: auth.tenantId,
          reviewId: id,
          stage: review.stage,
          authorUserId: auth.userId,
          comment: dto.comment?.trim() || 'Review submitted.',
        },
      });
    });

    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'hrms.appraisal.advance',
      module: 'hrms',
      entityType: 'AppraisalReview',
      entityId: id,
      metadata: { from: review.stage, to: data.stage },
    });
    return this.get(auth, id);
  }

  // ---------------------------------------------------------------------------
  // Role rules
  // ---------------------------------------------------------------------------

  /**
   * SELF: the reviewee. HOD: department head or reporting manager (or HR with appraisal.manage).
   * PRINCIPAL: holders of appraisal.principal. Nobody scores their own review after the self stage.
   */
  private async assertActorForStage(auth: AuthContext, review: ReviewRow) {
    const me = await this.repo.findStaffByUser(auth.userId, auth.email, auth.tenantId);
    const deny = (message: string) =>
      new ForbiddenException({ code: 'HRMS_APPRAISAL_ACTOR_DENIED', message });

    if (review.stage === 'SELF_REVIEW') {
      if (!me || me.id !== review.staffId) throw deny('Only the employee can complete the self review.');
      return;
    }
    if (me && me.id === review.staffId) throw deny('You cannot score your own review at this stage.');

    if (review.stage === 'HOD_REVIEW') {
      const isHod = !!me && (review.staff.department.headStaffId === me.id || review.staff.reportingManagerId === me.id);
      if (isHod || (await this.authz.hasPermission(auth.userId, auth.tenantId, 'hrms.appraisal.manage'))) return;
      throw deny('Only the department head or reporting manager can complete the HOD review.');
    }
    if (!(await this.authz.hasPermission(auth.userId, auth.tenantId, 'hrms.appraisal.principal'))) {
      throw deny('Only the Principal can complete the principal review.');
    }
  }

  private isParticipant(review: ReviewRow, staffId: string) {
    return (
      review.staffId === staffId ||
      review.staff.department.headStaffId === staffId ||
      review.staff.reportingManagerId === staffId
    );
  }

  private metricField(stage: AppraisalStage) {
    return ({
      SELF_REVIEW: 'selfScore',
      HOD_REVIEW: 'hodScore',
      PRINCIPAL_REVIEW: 'principalScore',
      HR_CLOSED: 'principalScore',
    } as const)[stage];
  }

  private assertOpen(review: ReviewRow) {
    if (review.stage === 'HR_CLOSED') {
      throw new BadRequestException({ code: 'HRMS_APPRAISAL_CLOSED', message: 'This appraisal is closed and can no longer be edited.' });
    }
  }

  private async requireMe(auth: AuthContext) {
    const me = await this.repo.findStaffByUser(auth.userId, auth.email, auth.tenantId);
    if (!me) {
      throw new NotFoundException({ code: 'HRMS_NO_STAFF_RECORD', message: 'No staff record is linked to your account. Contact HR.' });
    }
    return me;
  }

  private async findOrThrow(tenantId: string, id: string) {
    const row = await this.repo.findById(id, tenantId);
    if (!row) throw new NotFoundException({ code: 'HRMS_APPRAISAL_NOT_FOUND', message: 'Appraisal not found.' });
    return row;
  }

  private denied() {
    return new ForbiddenException({ code: 'HRMS_APPRAISAL_ACCESS_DENIED', message: 'You do not have access to this appraisal.' });
  }

  private toDto(r: ReviewRow) {
    const num = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));
    return {
      id: r.id,
      cycleId: r.cycleId,
      cycle: r.cycle.name,
      staffId: r.staffId,
      staffName: r.staff.fullName,
      designation: r.staff.designation,
      department: r.staff.department.name,
      category: r.staff.category.name,
      stage: r.stage,
      selfScore: num(r.selfScore),
      hodScore: num(r.hodScore),
      principalScore: num(r.principalScore),
      finalScore: num(r.finalScore),
      finalRating: r.finalRating,
      closedAt: isoDate(r.closedAt),
      metrics: r.metrics.map((m) => ({
        id: m.id,
        name: m.name,
        weight: m.weight,
        self: m.selfScore ?? 0,
        hod: m.hodScore ?? 0,
        principal: m.principalScore ?? 0,
      })),
      comments: r.comments.map((c) => ({ stage: c.stage, comment: c.comment, at: isoDate(c.createdAt) })),
    };
  }
}
