import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { CampusRepository } from '../repositories/campus.repository';
import { CreateCampusDto, UpdateCampusDto } from '../dto/campus.dto';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import { AuditService } from '../../audit/services/audit.service';
import { CampusStatus } from '../../../generated/prisma-client';

@Injectable()
export class CampusService {
  constructor(
    private readonly repo: CampusRepository,
    private readonly audit: AuditService,
  ) {}

  async list(auth: AuthContext, institutionId?: string) {
    if (institutionId) {
      await this.assertInstitution(auth, institutionId);
    }
    const rows = await this.repo.list(auth.tenantId, institutionId);
    return rows.map((r) => this.toDto(r));
  }

  async get(auth: AuthContext, id: string) {
    const row = await this.repo.findById(id, auth.tenantId);
    if (!row) {
      throw new NotFoundException({
        code: 'CAMPUS_NOT_FOUND',
        message: 'Campus not found.',
      });
    }
    return this.toDto(row);
  }

  async create(auth: AuthContext, dto: CreateCampusDto) {
    await this.assertInstitution(auth, dto.institutionId);
    try {
      const created = await this.repo.create({
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        addressLine1: dto.addressLine1?.trim(),
        city: dto.city?.trim(),
        state: dto.state?.trim(),
        country: dto.country?.trim(),
        status: CampusStatus.ACTIVE,
        tenant: { connect: { id: auth.tenantId } },
        institution: { connect: { id: dto.institutionId } },
      });
      await this.audit.log({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        action: 'campus.create',
        module: 'campus',
        entityType: 'Campus',
        entityId: created.id,
        metadata: { code: created.code },
      });
      return this.toDto(created);
    } catch (e: unknown) {
      if (
        typeof e === 'object' &&
        e &&
        'code' in e &&
        (e as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CAMPUS_CODE_EXISTS',
          message: 'Campus code already exists for this institution.',
        });
      }
      throw e;
    }
  }

  async update(auth: AuthContext, id: string, dto: UpdateCampusDto) {
    const existing = await this.repo.findById(id, auth.tenantId);
    if (!existing) {
      throw new NotFoundException({
        code: 'CAMPUS_NOT_FOUND',
        message: 'Campus not found.',
      });
    }
    if (dto.institutionId) {
      await this.assertInstitution(auth, dto.institutionId);
    }
    const result = await this.repo.update(id, auth.tenantId, {
      ...(dto.code !== undefined && { code: dto.code.trim().toUpperCase() }),
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.addressLine1 !== undefined && {
        addressLine1: dto.addressLine1?.trim() ?? null,
      }),
      ...(dto.city !== undefined && { city: dto.city?.trim() ?? null }),
      ...(dto.state !== undefined && { state: dto.state?.trim() ?? null }),
      ...(dto.country !== undefined && { country: dto.country?.trim() ?? null }),
      ...(dto.status !== undefined && { status: dto.status as CampusStatus }),
      ...(dto.institutionId !== undefined && {
        institution: { connect: { id: dto.institutionId } },
      }),
    });
    if (result.count === 0) {
      throw new ForbiddenException({
        code: 'AUTH_TENANT_ACCESS_DENIED',
        message: 'Campus not found.',
      });
    }
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'campus.update',
      module: 'campus',
      entityType: 'Campus',
      entityId: id,
    });
    return this.get(auth, id);
  }

  async archive(auth: AuthContext, id: string) {
    const result = await this.repo.softArchive(id, auth.tenantId);
    if (result.count === 0) {
      throw new NotFoundException({
        code: 'CAMPUS_NOT_FOUND',
        message: 'Campus not found.',
      });
    }
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'campus.archive',
      module: 'campus',
      entityType: 'Campus',
      entityId: id,
    });
    return { id, status: 'ARCHIVED' };
  }


  async assignUser(auth: AuthContext, dto: { userId: string; campusId: string }) {
    const campus = await this.repo.findById(dto.campusId, auth.tenantId);
    if (!campus) {
      throw new NotFoundException({
        code: 'CAMPUS_NOT_FOUND',
        message: 'Campus not found.',
      });
    }
    const user = await this.repo.findUserInTenant(dto.userId, auth.tenantId);
    if (!user) {
      throw new ForbiddenException({
        code: 'AUTH_TENANT_ACCESS_DENIED',
        message: 'User not found in your organization.',
      });
    }
    const existing = await this.repo.findActiveAssignment(
      dto.userId,
      dto.campusId,
      auth.tenantId,
    );
    if (existing) {
      throw new ConflictException({
        code: 'CAMPUS_ASSIGNMENT_EXISTS',
        message: 'User is already assigned to this campus.',
      });
    }
    const created = await this.repo.createAssignment({
      tenantId: auth.tenantId,
      institutionId: campus.institutionId,
      campusId: campus.id,
      userId: dto.userId,
    });
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'campus.assignment.create',
      module: 'campus',
      entityType: 'UserCampusAssignment',
      entityId: created.id,
      metadata: { userId: dto.userId, campusId: dto.campusId },
    });
    return {
      id: created.id,
      userId: created.userId,
      campusId: created.campusId,
      institutionId: created.institutionId,
      status: created.status,
      campus: {
        id: created.campus.id,
        code: created.campus.code,
        name: created.campus.name,
      },
    };
  }

  async listMyCampuses(auth: AuthContext) {
    const rows = await this.repo.listAssignmentsForUser(
      auth.userId,
      auth.tenantId,
    );
    return rows.map((r) => ({
      assignmentId: r.id,
      campusId: r.campusId,
      institutionId: r.institutionId,
      status: r.status,
      campus: {
        id: r.campus.id,
        code: r.campus.code,
        name: r.campus.name,
        status: r.campus.status,
      },
    }));
  }

  async revokeAssignment(auth: AuthContext, assignmentId: string) {
    const existing = await this.repo.findAssignment(assignmentId, auth.tenantId);
    if (!existing) {
      throw new NotFoundException({
        code: 'CAMPUS_ASSIGNMENT_NOT_FOUND',
        message: 'Assignment not found.',
      });
    }
    await this.repo.updateAssignmentStatus(
      assignmentId,
      auth.tenantId,
      'REVOKED',
    );
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'campus.assignment.revoke',
      module: 'campus',
      entityType: 'UserCampusAssignment',
      entityId: assignmentId,
    });
    return { id: assignmentId, status: 'REVOKED' };
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
    code: string;
    name: string;
    status: string;
    addressLine1: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      institutionId: row.institutionId,
      code: row.code,
      name: row.name,
      status: row.status,
      addressLine1: row.addressLine1,
      city: row.city,
      state: row.state,
      country: row.country,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
