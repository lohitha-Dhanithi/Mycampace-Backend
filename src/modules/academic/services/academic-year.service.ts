import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AcademicYearStatus } from '../../../generated/prisma-client';
import { AcademicYearRepository } from '../repositories/academic-year.repository';
import { AuditService } from '../../audit/services/audit.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
  AcademicYearResponseDto,
  AcademicYearStatusDto,
} from '../dto/academic-year.dto';

@Injectable()
export class AcademicYearService {
  constructor(
    private readonly repo: AcademicYearRepository,
    private readonly audit: AuditService,
  ) {}

  async list(
    auth: AuthContext,
    institutionId?: string,
  ): Promise<AcademicYearResponseDto[]> {
    const rows = await this.repo.list(auth.tenantId, institutionId);
    return rows.map((r) => this.toDto(r));
  }

  async get(auth: AuthContext, id: string): Promise<AcademicYearResponseDto> {
    const row = await this.repo.findById(id, auth.tenantId);
    if (!row) {
      throw new NotFoundException({
        code: 'ACADEMIC_YEAR_NOT_FOUND',
        message: 'Academic year not found.',
      });
    }
    return this.toDto(row);
  }

  async create(
    auth: AuthContext,
    dto: CreateAcademicYearDto,
  ): Promise<AcademicYearResponseDto> {
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

    const code = dto.code.trim();
    this.assertDateRange(dto.startDate, dto.endDate);

    const existing = await this.repo.findByCode(
      auth.tenantId,
      dto.institutionId,
      code,
    );
    if (existing) {
      throw new ConflictException({
        code: 'ACADEMIC_YEAR_EXISTS',
        message: 'An academic year with this code already exists for the institution.',
      });
    }

    const status =
      (dto.status as AcademicYearStatus | undefined) ??
      AcademicYearStatus.INACTIVE;

    if (status === AcademicYearStatus.ACTIVE) {
      const created = await this.repo.create({
        code,
        name: dto.name?.trim(),
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: AcademicYearStatus.INACTIVE,
        tenant: { connect: { id: auth.tenantId } },
        institution: { connect: { id: dto.institutionId } },
      });
      const activated = await this.repo.setActiveExclusive(
        auth.tenantId,
        dto.institutionId,
        created.id,
      );
      await this.audit.log({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        action: 'academic.year.create',
        module: 'academic',
        result: 'SUCCESS',
        entityType: 'AcademicYear',
        entityId: created.id,
      });
      return this.toDto(activated!);
    }

    const created = await this.repo.create({
      code,
      name: dto.name?.trim(),
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      status,
      tenant: { connect: { id: auth.tenantId } },
      institution: { connect: { id: dto.institutionId } },
    });

    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'academic.year.create',
      module: 'academic',
      result: 'SUCCESS',
      entityType: 'AcademicYear',
      entityId: created.id,
    });

    return this.toDto(created);
  }

  async update(
    auth: AuthContext,
    id: string,
    dto: UpdateAcademicYearDto,
  ): Promise<AcademicYearResponseDto> {
    const row = await this.repo.findById(id, auth.tenantId);
    if (!row) {
      throw new NotFoundException({
        code: 'ACADEMIC_YEAR_NOT_FOUND',
        message: 'Academic year not found.',
      });
    }

    const start = dto.startDate ?? row.startDate.toISOString().slice(0, 10);
    const end = dto.endDate ?? row.endDate.toISOString().slice(0, 10);
    this.assertDateRange(start, end);

    if (dto.status === AcademicYearStatusDto.ACTIVE) {
      const activated = await this.repo.setActiveExclusive(
        auth.tenantId,
        row.institutionId,
        id,
      );
      if (dto.code || dto.name || dto.startDate || dto.endDate) {
        await this.repo.update(id, auth.tenantId, {
          ...(dto.code ? { code: dto.code.trim() } : {}),
          ...(dto.name !== undefined ? { name: dto.name?.trim() } : {}),
          ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
          ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
        });
      }
      await this.audit.log({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        action: 'academic.year.activate',
        module: 'academic',
        result: 'SUCCESS',
        entityType: 'AcademicYear',
        entityId: id,
      });
      const refreshed = await this.repo.findById(id, auth.tenantId);
      return this.toDto(refreshed!);
    }

    await this.repo.update(id, auth.tenantId, {
      ...(dto.code ? { code: dto.code.trim() } : {}),
      ...(dto.name !== undefined ? { name: dto.name?.trim() } : {}),
      ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
      ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
      ...(dto.status
        ? { status: dto.status as AcademicYearStatus }
        : {}),
    });

    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'academic.year.update',
      module: 'academic',
      result: 'SUCCESS',
      entityType: 'AcademicYear',
      entityId: id,
    });

    const refreshed = await this.repo.findById(id, auth.tenantId);
    return this.toDto(refreshed!);
  }

  private assertDateRange(start: string, end: string) {
    const s = new Date(start);
    const e = new Date(end);
    if (!(s instanceof Date) || Number.isNaN(s.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_START_DATE',
        message: 'Invalid start date.',
      });
    }
    if (!(e instanceof Date) || Number.isNaN(e.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_END_DATE',
        message: 'Invalid end date.',
      });
    }
    if (e < s) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'End date must be on or after start date.',
      });
    }
  }

  private toDto(row: {
    id: string;
    tenantId: string;
    institutionId: string;
    code: string;
    name: string | null;
    startDate: Date;
    endDate: Date;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    institution?: {
      name: string;
      institutionCode: string;
      city: string | null;
      state: string | null;
    } | null;
  }): AcademicYearResponseDto {
    const loc = [row.institution?.city, row.institution?.state]
      .filter(Boolean)
      .join(', ');
    return {
      id: row.id,
      tenantId: row.tenantId,
      institutionId: row.institutionId,
      code: row.code,
      name: row.name,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      status: row.status,
      institutionName: row.institution?.name,
      institutionCode: row.institution?.institutionCode,
      location: loc || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
