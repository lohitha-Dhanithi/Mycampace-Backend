import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StaffStatus } from '../../../generated/prisma-client';
import { STAFF_INCLUDE, StaffRepository } from '../repositories/staff.repository';
import { LeaveService } from './leave.service';
import { AppraisalService } from './appraisal.service';
import { AuditService } from '../../audit/services/audit.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import {
  AddCertificationDto,
  AddServiceEventDto,
  AddStaffDocumentDto,
  CreateStaffDto,
  UpdateDocumentStatusDto,
  UpdateMyProfileDto,
  UpdateStaffDto,
} from '../dto/staff.dto';
import { isoDate, parseDate, todayUtc } from '../common/hrms.util';

type StaffRow = Prisma.StaffGetPayload<{ include: typeof STAFF_INCLUDE }>;

const EXPIRY_WARNING_DAYS = 60;

@Injectable()
export class StaffService {
  constructor(
    private readonly repo: StaffRepository,
    private readonly leave: LeaveService,
    private readonly appraisal: AppraisalService,
    private readonly audit: AuditService,
  ) {}

  async list(
    auth: AuthContext,
    q: {
      search?: string;
      categoryId?: string;
      status?: StaffStatus;
      campusId?: string;
      departmentId?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
    const { rows, total } = await this.repo.list(auth.tenantId, { ...q, page, pageSize });
    return { items: rows.map((r) => this.toDto(r)), total, page, pageSize };
  }

  async get(auth: AuthContext, id: string) {
    return this.toDto(await this.findOrThrow(auth.tenantId, id));
  }

  /** Full employee record: documents, service history, certifications, balances, appraisal. */
  async profile(auth: AuthContext, id: string) {
    const staff = await this.findOrThrow(auth.tenantId, id);
    const [documents, serviceEvents, certifications, balances, appraisals] = await Promise.all([
      this.repo.documents(id, auth.tenantId),
      this.repo.serviceEvents(id, auth.tenantId),
      this.repo.certifications(id, auth.tenantId),
      this.leave.balancesFor(auth, id),
      this.appraisal.listForStaff(auth, id),
    ]);
    return {
      staff: this.toDto(staff),
      documents: documents.map((d) => ({
        id: d.id,
        type: d.type,
        name: d.name,
        uploadedOn: isoDate(d.uploadedAt),
        expiryDate: isoDate(d.expiryDate),
        status: d.status,
      })),
      serviceEvents: serviceEvents.map((e) => ({
        id: e.id,
        date: isoDate(e.eventDate),
        title: e.title,
        detail: e.detail,
      })),
      certifications: certifications.map((c) => ({
        id: c.id,
        name: c.name,
        issuer: c.issuer,
        issuedOn: isoDate(c.issuedOn),
        validUntil: isoDate(c.validUntil),
        status: c.status,
      })),
      balances,
      appraisal: appraisals[0] ?? null,
    };
  }

  async create(auth: AuthContext, dto: CreateStaffDto) {
    await this.assertRefs(auth.tenantId, dto);
    await this.assertEmailFree(auth.tenantId, dto.email);
    const campus = await this.repo.findCampus(dto.campusId, auth.tenantId);

    // Employee code is max+1; the (tenant, code) unique index backstops a concurrent create.
    let staff: StaffRow | null = null;
    for (let attempt = 0; attempt < 3 && !staff; attempt += 1) {
      const next = Math.max(2400, await this.repo.maxEmployeeNumber(auth.tenantId)) + 1;
      try {
        staff = await this.repo.createWithJoinEvent(
          {
            tenantId: auth.tenantId,
            institutionId: campus!.institutionId,
            campusId: dto.campusId,
            userId: dto.userId,
            employeeCode: `EMP-${next}`,
            fullName: dto.fullName.trim(),
            email: dto.email.trim().toLowerCase(),
            phone: dto.phone?.trim(),
            categoryId: dto.categoryId,
            departmentId: dto.departmentId,
            designation: dto.designation.trim(),
            reportingManagerId: dto.reportingManagerId,
            joiningDate: parseDate(dto.joiningDate),
            status: dto.status ?? 'ACTIVE',
            qualification: dto.qualification?.trim(),
            experienceYears: dto.experienceYears ?? 0,
          },
          auth.userId,
        );
      } catch (e) {
        const duplicateCode =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          String(e.meta?.target).includes('employee_code');
        if (!duplicateCode) throw e;
      }
    }
    if (!staff) {
      throw new ConflictException({ code: 'HRMS_EMPLOYEE_CODE_CONFLICT', message: 'Could not allocate an employee code. Retry.' });
    }

    await this.leave.ensureBalances(auth.tenantId, staff);
    await this.appraisal.enrolInOpenCycle(auth.tenantId, staff.id, staff.categoryId);
    await this.log(auth, 'hrms.staff.create', staff.id, { employeeCode: staff.employeeCode });
    return this.toDto(staff);
  }

  async update(auth: AuthContext, id: string, dto: UpdateStaffDto) {
    const existing = await this.findOrThrow(auth.tenantId, id);
    await this.assertRefs(auth.tenantId, dto);
    if (dto.email && dto.email.trim().toLowerCase() !== existing.email.toLowerCase()) {
      await this.assertEmailFree(auth.tenantId, dto.email, id);
    }
    if (dto.reportingManagerId) await this.assertNoCycle(auth.tenantId, id, dto.reportingManagerId);

    const campus = dto.campusId ? await this.repo.findCampus(dto.campusId, auth.tenantId) : null;
    await this.repo.update(id, auth.tenantId, {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.campusId ? { campusId: dto.campusId, institutionId: campus!.institutionId } : {}),
      ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
      ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
      ...(dto.designation !== undefined ? { designation: dto.designation.trim() } : {}),
      ...(dto.reportingManagerId !== undefined ? { reportingManagerId: dto.reportingManagerId } : {}),
      ...(dto.joiningDate ? { joiningDate: parseDate(dto.joiningDate) } : {}),
      ...(dto.separationDate ? { separationDate: parseDate(dto.separationDate) } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.qualification !== undefined ? { qualification: dto.qualification.trim() } : {}),
      ...(dto.experienceYears !== undefined ? { experienceYears: dto.experienceYears } : {}),
      ...(dto.userId !== undefined ? { userId: dto.userId } : {}),
    });

    if (dto.status === 'SEPARATED' && existing.status !== 'SEPARATED') {
      await this.repo.createServiceEvent({
        tenantId: auth.tenantId,
        staffId: id,
        eventDate: dto.separationDate ? parseDate(dto.separationDate) : todayUtc(),
        title: 'Separated from the institution',
        createdById: auth.userId,
      });
    }
    await this.log(auth, 'hrms.staff.update', id);
    return this.get(auth, id);
  }

  // ---- My Portal ----
  async me(auth: AuthContext) {
    return this.toDto(await this.requireMe(auth));
  }

  async updateMe(auth: AuthContext, dto: UpdateMyProfileDto) {
    const me = await this.requireMe(auth);
    await this.repo.update(me.id, auth.tenantId, {
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.qualification !== undefined ? { qualification: dto.qualification.trim() } : {}),
    });
    await this.log(auth, 'hrms.staff.update_self', me.id);
    return this.get(auth, me.id);
  }

  // ---- Documents / events / certifications ----
  async addDocument(auth: AuthContext, staffId: string, dto: AddStaffDocumentDto) {
    await this.findOrThrow(auth.tenantId, staffId);
    const row = await this.repo.createDocument({
      tenantId: auth.tenantId,
      staffId,
      type: dto.type.trim(),
      name: dto.name.trim(),
      storageKey: dto.storageKey,
      expiryDate: dto.expiryDate ? parseDate(dto.expiryDate) : undefined,
      uploadedById: auth.userId,
    });
    await this.log(auth, 'hrms.staff_document.add', row.id, { staffId, type: row.type });
    return row;
  }

  async updateDocumentStatus(auth: AuthContext, documentId: string, dto: UpdateDocumentStatusDto) {
    const doc = await this.repo.findDocument(documentId, auth.tenantId);
    if (!doc) throw new NotFoundException({ code: 'HRMS_DOCUMENT_NOT_FOUND', message: 'Document not found.' });
    const verified = dto.status === 'VERIFIED';
    await this.repo.updateDocument(documentId, auth.tenantId, {
      status: dto.status,
      verifiedById: verified ? auth.userId : null,
      verifiedAt: verified ? new Date() : null,
    });
    await this.log(auth, 'hrms.staff_document.status', documentId, { status: dto.status });
    return this.repo.findDocument(documentId, auth.tenantId);
  }

  async addServiceEvent(auth: AuthContext, staffId: string, dto: AddServiceEventDto) {
    await this.findOrThrow(auth.tenantId, staffId);
    const row = await this.repo.createServiceEvent({
      tenantId: auth.tenantId,
      staffId,
      eventDate: parseDate(dto.date),
      title: dto.title.trim(),
      detail: dto.detail?.trim(),
      createdById: auth.userId,
    });
    await this.log(auth, 'hrms.service_event.add', row.id, { staffId });
    return row;
  }

  async addCertification(auth: AuthContext, staffId: string, dto: AddCertificationDto) {
    await this.findOrThrow(auth.tenantId, staffId);
    const validUntil = dto.validUntil ? parseDate(dto.validUntil) : undefined;
    const row = await this.repo.createCertification({
      tenantId: auth.tenantId,
      staffId,
      name: dto.name.trim(),
      issuer: dto.issuer?.trim(),
      issuedOn: dto.issuedOn ? parseDate(dto.issuedOn) : undefined,
      validUntil,
      status: this.certStatus(validUntil),
    });
    await this.log(auth, 'hrms.certification.add', row.id, { staffId });
    return row;
  }

  // ---- Helpers ----
  private certStatus(validUntil?: Date) {
    if (!validUntil) return 'VALID' as const;
    const today = todayUtc();
    if (validUntil < today) return 'EXPIRED' as const;
    const warnBy = new Date(today.getTime() + EXPIRY_WARNING_DAYS * 86_400_000);
    return validUntil <= warnBy ? ('EXPIRING' as const) : ('VALID' as const);
  }

  private async requireMe(auth: AuthContext) {
    const me = await this.repo.findByUser(auth.userId, auth.email, auth.tenantId);
    if (!me) {
      throw new NotFoundException({
        code: 'HRMS_NO_STAFF_RECORD',
        message: 'No staff record is linked to your account. Contact HR.',
      });
    }
    return me;
  }

  private async findOrThrow(tenantId: string, id: string) {
    const row = await this.repo.findById(id, tenantId);
    if (!row) throw new NotFoundException({ code: 'HRMS_STAFF_NOT_FOUND', message: 'Staff record not found.' });
    return row;
  }

  private async assertEmailFree(tenantId: string, email: string, exceptId?: string) {
    const clash = await this.repo.findByEmail(tenantId, email.trim());
    if (clash && clash.id !== exceptId) {
      throw new ConflictException({ code: 'HRMS_STAFF_EMAIL_EXISTS', message: 'A staff member with this email already exists.' });
    }
  }

  private async assertRefs(tenantId: string, dto: Partial<CreateStaffDto>) {
    const bad = (code: string, message: string) => new BadRequestException({ code, message });
    if (dto.campusId && !(await this.repo.findCampus(dto.campusId, tenantId))) {
      throw bad('CAMPUS_NOT_FOUND', 'Campus not found in your tenant.');
    }
    if (dto.categoryId && !(await this.repo.findCategory(dto.categoryId, tenantId))) {
      throw bad('HRMS_CATEGORY_NOT_FOUND', 'Category not found.');
    }
    if (dto.departmentId && !(await this.repo.findDepartment(dto.departmentId, tenantId))) {
      throw bad('HRMS_DEPARTMENT_NOT_FOUND', 'Department not found.');
    }
    if (dto.reportingManagerId && !(await this.repo.findById(dto.reportingManagerId, tenantId))) {
      throw bad('HRMS_MANAGER_NOT_FOUND', 'Reporting manager not found.');
    }
    if (dto.userId && !(await this.repo.findUser(dto.userId, tenantId))) {
      throw bad('USER_NOT_FOUND', 'User not found in your tenant.');
    }
  }

  /** A staff member must not end up (transitively) reporting to themselves. */
  private async assertNoCycle(tenantId: string, staffId: string, managerId: string) {
    let cursor: string | null = managerId;
    for (let hop = 0; cursor && hop < 50; hop += 1) {
      if (cursor === staffId) {
        throw new BadRequestException({ code: 'HRMS_REPORTING_CYCLE', message: 'This reporting line would create a loop.' });
      }
      const row: StaffRow | null = await this.repo.findById(cursor, tenantId);
      cursor = row?.reportingManagerId ?? null;
    }
  }

  private log(auth: AuthContext, action: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action,
      module: 'hrms',
      entityType: 'Staff',
      entityId,
      metadata,
    });
  }

  private toDto(r: StaffRow) {
    return {
      id: r.id,
      employeeCode: r.employeeCode,
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,
      category: r.category.name,
      categoryId: r.categoryId,
      isTeaching: r.category.isTeaching,
      designation: r.designation,
      department: r.department.name,
      departmentId: r.departmentId,
      campus: r.campus.name,
      campusId: r.campusId,
      reportingManager: r.reportingManager?.fullName ?? null,
      reportingManagerId: r.reportingManagerId,
      joiningDate: isoDate(r.joiningDate),
      separationDate: isoDate(r.separationDate),
      status: r.status,
      qualification: r.qualification,
      experienceYears: Number(r.experienceYears),
      userId: r.userId,
    };
  }
}
