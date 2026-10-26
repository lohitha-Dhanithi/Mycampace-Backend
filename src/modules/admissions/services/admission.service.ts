import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AdmissionRepository } from '../repositories/admission.repository';
import {
  CreateAdmissionDto,
  UpdateAdmissionDto,
  UpdateAdmissionStatusDto,
} from '../dto/admission.dto';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import { AdmissionStatus } from '../../../generated/prisma-client';
import { AuditService } from '../../audit/services/audit.service';

const DECISION_STATUSES: AdmissionStatus[] = [
  AdmissionStatus.ACCEPTED,
  AdmissionStatus.REJECTED,
  AdmissionStatus.WITHDRAWN,
];

@Injectable()
export class AdmissionService {
  constructor(
    private readonly repo: AdmissionRepository,
    private readonly audit: AuditService,
  ) {}

  async list(
    auth: AuthContext,
    filters?: { institutionId?: string; status?: string },
  ) {
    if (filters?.institutionId) {
      await this.assertInstitution(auth, filters.institutionId);
    }
    const rows = await this.repo.list(auth.tenantId, filters);
    return rows.map((r) => this.toDto(r));
  }

  async get(auth: AuthContext, id: string) {
    const row = await this.repo.findById(id, auth.tenantId);
    if (!row) {
      throw new NotFoundException({
        code: 'ADMISSION_NOT_FOUND',
        message: 'Application not found.',
      });
    }
    return this.toDto(row);
  }

  async create(auth: AuthContext, dto: CreateAdmissionDto) {
    await this.assertInstitution(auth, dto.institutionId);
    const applicationNo = await this.repo.nextApplicationNo(auth.tenantId);
    const created = await this.repo.create({
      applicationNo,
      status: AdmissionStatus.SUBMITTED,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone?.trim(),
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      programApplied: dto.programApplied?.trim(),
      academicYear: dto.academicYear?.trim(),
      notes: dto.notes?.trim(),
      submittedAt: new Date(),
      tenant: { connect: { id: auth.tenantId } },
      institution: { connect: { id: dto.institutionId } },
    });
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'admission.create',
      module: 'admissions',
      entityType: 'AdmissionApplication',
      entityId: created.id,
      metadata: { applicationNo: created.applicationNo },
    });
    return this.toDto(created);
  }

  async update(auth: AuthContext, id: string, dto: UpdateAdmissionDto) {
    const existing = await this.repo.findById(id, auth.tenantId);
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMISSION_NOT_FOUND',
        message: 'Application not found.',
      });
    }
    if (dto.institutionId) {
      await this.assertInstitution(auth, dto.institutionId);
    }

    const result = await this.repo.update(id, auth.tenantId, {
      ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
      ...(dto.email !== undefined && {
        email: dto.email.trim().toLowerCase(),
      }),
      ...(dto.phone !== undefined && { phone: dto.phone?.trim() ?? null }),
      ...(dto.dateOfBirth !== undefined && {
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      }),
      ...(dto.programApplied !== undefined && {
        programApplied: dto.programApplied?.trim() ?? null,
      }),
      ...(dto.academicYear !== undefined && {
        academicYear: dto.academicYear?.trim() ?? null,
      }),
      ...(dto.notes !== undefined && { notes: dto.notes?.trim() ?? null }),
      ...(dto.status !== undefined && {
        status: dto.status as AdmissionStatus,
        ...(DECISION_STATUSES.includes(dto.status as AdmissionStatus)
          ? { decidedAt: new Date(), decidedBy: auth.userId }
          : {}),
        ...(dto.status === 'UNDER_REVIEW'
          ? { reviewedAt: new Date() }
          : {}),
      }),
      ...(dto.institutionId !== undefined && {
        institution: { connect: { id: dto.institutionId } },
      }),
    });

    if (result.count === 0) {
      throw new ForbiddenException({
        code: 'AUTH_TENANT_ACCESS_DENIED',
        message: 'Application not found.',
      });
    }
    return this.get(auth, id);
  }

  async updateStatus(
    auth: AuthContext,
    id: string,
    dto: UpdateAdmissionStatusDto,
  ) {
    return this.update(auth, id, { status: dto.status });
  }

  async metrics(auth: AuthContext, institutionId?: string) {
    if (institutionId) {
      await this.assertInstitution(auth, institutionId);
    }
    const groups = await this.repo.countByStatus(auth.tenantId, institutionId);
    const byStatus: Record<string, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      ACCEPTED: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
    };
    let total = 0;
    for (const g of groups) {
      byStatus[g.status] = g._count._all;
      total += g._count._all;
    }
    return { total, byStatus };
  }


  // ---------- Applicant portal (ownership-scoped) ----------

  async listMine(auth: AuthContext) {
    const rows = await this.repo.findByApplicant(auth.userId, auth.tenantId);
    return rows.map((r) => this.toApplicantDto(r));
  }

  async getMine(auth: AuthContext, id: string) {
    const row = await this.repo.findByIdForApplicant(
      id,
      auth.userId,
      auth.tenantId,
    );
    if (!row) {
      throw new NotFoundException({
        code: 'ADMISSION_NOT_FOUND',
        message: 'Application not found.',
      });
    }
    return this.toApplicantDto(row);
  }

  async createMine(auth: AuthContext, dto: CreateAdmissionDto) {
    await this.assertInstitution(auth, dto.institutionId);
    const applicationNo = await this.repo.nextApplicationNo(auth.tenantId);
    const created = await this.repo.create({
      applicationNo,
      status: AdmissionStatus.SUBMITTED,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: dto.email.trim().toLowerCase() || auth.email,
      phone: dto.phone?.trim(),
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      programApplied: dto.programApplied?.trim(),
      academicYear: dto.academicYear?.trim(),
      notes: dto.notes?.trim(),
      submittedAt: new Date(),
      applicant: { connect: { id: auth.userId } },
      tenant: { connect: { id: auth.tenantId } },
      institution: { connect: { id: dto.institutionId } },
    });
    return this.toApplicantDto(created);
  }

  async updateMine(auth: AuthContext, id: string, dto: UpdateAdmissionDto) {
    const existing = await this.repo.findByIdForApplicant(
      id,
      auth.userId,
      auth.tenantId,
    );
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMISSION_NOT_FOUND',
        message: 'Application not found.',
      });
    }

    // Applicants cannot set staff decision statuses
    if (dto.status) {
      const allowed = ['SUBMITTED', 'WITHDRAWN'];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException({
          code: 'ADMISSION_STATUS_FORBIDDEN',
          message: 'You cannot set this application status.',
        });
      }
      if (
        ['ACCEPTED', 'REJECTED'].includes(existing.status) &&
        dto.status === 'WITHDRAWN'
      ) {
        throw new BadRequestException({
          code: 'ADMISSION_STATUS_FORBIDDEN',
          message: 'This application can no longer be withdrawn.',
        });
      }
    }

    // Cannot reassign institution after create via applicant API for simplicity
    const { institutionId: _ignore, ...safe } = dto;

    const result = await this.repo.update(id, auth.tenantId, {
      ...(safe.firstName !== undefined && { firstName: safe.firstName.trim() }),
      ...(safe.lastName !== undefined && { lastName: safe.lastName.trim() }),
      ...(safe.email !== undefined && {
        email: safe.email.trim().toLowerCase(),
      }),
      ...(safe.phone !== undefined && { phone: safe.phone?.trim() ?? null }),
      ...(safe.dateOfBirth !== undefined && {
        dateOfBirth: safe.dateOfBirth ? new Date(safe.dateOfBirth) : null,
      }),
      ...(safe.programApplied !== undefined && {
        programApplied: safe.programApplied?.trim() ?? null,
      }),
      ...(safe.academicYear !== undefined && {
        academicYear: safe.academicYear?.trim() ?? null,
      }),
      ...(safe.notes !== undefined && { notes: safe.notes?.trim() ?? null }),
      ...(safe.status !== undefined && {
        status: safe.status as AdmissionStatus,
        ...(safe.status === 'WITHDRAWN'
          ? { decidedAt: new Date(), decidedBy: auth.userId }
          : {}),
      }),
    });

    if (result.count === 0) {
      throw new ForbiddenException({
        code: 'AUTH_TENANT_ACCESS_DENIED',
        message: 'Application not found.',
      });
    }
    return this.getMine(auth, id);
  }

  private toApplicantDto(row: Parameters<AdmissionService['toDto']>[0]) {
    const full = this.toDto(row);
    // Roadmap steps derived only from real status — no fake completion %
    const steps = [
      { key: 'SUBMITTED', label: 'Application submitted', done: true },
      {
        key: 'UNDER_REVIEW',
        label: 'Under review',
        done: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED'].includes(full.status),
      },
      {
        key: 'DECISION',
        label: 'Admission decision',
        done: ['ACCEPTED', 'REJECTED'].includes(full.status),
      },
    ];
    return {
      ...full,
      roadmap: steps,
      deferred: {
        documents:
          'Document upload not in this slice — deferred until document domain is approved',
        fees: 'Application fee payment not implemented — Finance module deferred',
        counsellor: 'Counsellor assignment model not implemented',
      },
    };
  }

  private async assertInstitution(auth: AuthContext, institutionId: string) {
    const inst = await this.repo.findInstitution(institutionId, auth.tenantId);
    if (!inst) {
      throw new ForbiddenException({
        code: 'AUTH_TENANT_ACCESS_DENIED',
        message: 'Institution not found in your organization.',
      });
    }
    return inst;
  }

  private toDto(row: {
    id: string;
    tenantId: string;
    institutionId: string;
    applicationNo: string;
    status: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    dateOfBirth: Date | null;
    programApplied: string | null;
    academicYear: string | null;
    notes: string | null;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    decidedAt: Date | null;
    decidedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    institution?: {
      id: string;
      name: string;
      institutionCode: string;
    };
  }) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      institutionId: row.institutionId,
      applicationNo: row.applicationNo,
      status: row.status,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      programApplied: row.programApplied,
      academicYear: row.academicYear,
      notes: row.notes,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      decidedBy: row.decidedBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      institution: row.institution
        ? {
            id: row.institution.id,
            name: row.institution.name,
            institutionCode: row.institution.institutionCode,
          }
        : undefined,
    };
  }
}
