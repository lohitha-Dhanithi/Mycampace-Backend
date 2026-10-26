import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DepartmentStatus } from '../../../generated/prisma-client';
import { DepartmentRepository } from '../repositories/department.repository';
import { AuditService } from '../../audit/services/audit.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  DepartmentResponseDto,
  DepartmentStatusDto,
} from '../dto/department.dto';

@Injectable()
export class DepartmentService {
  constructor(
    private readonly repo: DepartmentRepository,
    private readonly audit: AuditService,
  ) {}

  async list(
    auth: AuthContext,
    institutionId?: string,
  ): Promise<DepartmentResponseDto[]> {
    const rows = await this.repo.list(auth.tenantId, institutionId);
    return rows.map((r) => this.toDto(r));
  }

  async get(auth: AuthContext, id: string): Promise<DepartmentResponseDto> {
    const row = await this.repo.findById(id, auth.tenantId);
    if (!row) {
      throw new NotFoundException({
        code: 'DEPARTMENT_NOT_FOUND',
        message: 'Department not found.',
      });
    }
    return this.toDto(row);
  }

  async create(
    auth: AuthContext,
    dto: CreateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    const inst = await this.repo.findInstitution(
      auth.tenantId,
      dto.institutionId,
    );
    if (!inst) {
      throw new ForbiddenException({
        code: 'INSTITUTION_SCOPE_DENIED',
        message: 'Institution not found in your tenant.',
      });
    }

    const code = dto.code.trim().toUpperCase();
    const existing = await this.repo.findByCode(
      auth.tenantId,
      dto.institutionId,
      code,
    );
    if (existing) {
      throw new ConflictException({
        code: 'DEPARTMENT_CODE_EXISTS',
        message: 'A department with this code already exists for the institution.',
      });
    }

    const created = await this.repo.create({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      status: (dto.status as DepartmentStatus | undefined) ?? DepartmentStatus.ACTIVE,
      tenant: { connect: { id: auth.tenantId } },
      institution: { connect: { id: dto.institutionId } },
    });

    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'department.create',
      module: 'academic',
      entityType: 'Department',
      entityId: created.id,
      result: 'SUCCESS',
    });

    return this.toDto(created);
  }

  async update(
    auth: AuthContext,
    id: string,
    dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    const row = await this.repo.findById(id, auth.tenantId);
    if (!row) {
      throw new NotFoundException({
        code: 'DEPARTMENT_NOT_FOUND',
        message: 'Department not found.',
      });
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.repo.findByCode(
        auth.tenantId,
        row.institutionId,
        code,
      );
      if (clash && clash.id !== id) {
        throw new ConflictException({
          code: 'DEPARTMENT_CODE_EXISTS',
          message: 'A department with this code already exists for the institution.',
        });
      }
    }

    await this.repo.update(id, auth.tenantId, {
      ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description?.trim() }
        : {}),
      ...(dto.status
        ? { status: dto.status as DepartmentStatus }
        : {}),
    });

    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'department.update',
      module: 'academic',
      entityType: 'Department',
      entityId: id,
      result: 'SUCCESS',
    });

    const refreshed = await this.repo.findById(id, auth.tenantId);
    return this.toDto(refreshed!);
  }

  async archive(auth: AuthContext, id: string): Promise<{ message: string }> {
    const row = await this.repo.findById(id, auth.tenantId);
    if (!row) {
      throw new NotFoundException({
        code: 'DEPARTMENT_NOT_FOUND',
        message: 'Department not found.',
      });
    }

    await this.repo.softArchive(id, auth.tenantId);

    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'department.archive',
      module: 'academic',
      entityType: 'Department',
      entityId: id,
      result: 'SUCCESS',
    });

    return { message: 'Department archived.' };
  }

  private toDto(row: {
    id: string;
    tenantId: string;
    institutionId: string;
    code: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    institution?: { name: string; institutionCode: string } | null;
  }): DepartmentResponseDto {
    return {
      id: row.id,
      tenantId: row.tenantId,
      institutionId: row.institutionId,
      code: row.code,
      name: row.name,
      description: row.description,
      status: row.status,
      // Programs module not yet implemented — honest empty list
      programs: [],
      institutionName: row.institution?.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
