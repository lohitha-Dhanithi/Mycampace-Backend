import { AuditService } from '../../audit/services/audit.service';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InstitutionRepository } from '../repositories/institution.repository';
import {
  CreateInstitutionDto,
  UpdateInstitutionDto,
  InstitutionResponseDto,
} from '../dto/institution.dto';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@Injectable()
export class InstitutionService {
  constructor(private readonly repo: InstitutionRepository,
    private readonly audit: AuditService,
  ) {}

  async list(auth: AuthContext): Promise<InstitutionResponseDto[]> {
    const rows = await this.repo.listByTenant(auth.tenantId);
    return Promise.all(rows.map((r) => this.toDto(r, auth.tenantId)));
  }

  async getById(auth: AuthContext, id: string): Promise<InstitutionResponseDto> {
    const row = await this.repo.findByIdForTenant(id, auth.tenantId);
    if (!row) {
      throw new NotFoundException({
        code: 'INSTITUTION_NOT_FOUND',
        message: 'Institution not found.',
      });
    }
    return this.toDto(row, auth.tenantId);
  }

  async create(
    auth: AuthContext,
    dto: CreateInstitutionDto,
  ): Promise<InstitutionResponseDto> {
    // tenantId always from auth — never from client body
    const code = dto.institutionCode.trim().toUpperCase();
    const existing = await this.repo.findByCodeForTenant(code, auth.tenantId);
    if (existing) {
      throw new ConflictException({
        code: 'INSTITUTION_CODE_EXISTS',
        message: 'An institution with this code already exists in your organization.',
      });
    }

    const created = await this.repo.create({
      institutionCode: code,
      name: dto.name.trim(),
      legalName: dto.legalName?.trim(),
      institutionType: dto.institutionType?.trim(),
      email: dto.email?.trim().toLowerCase(),
      phone: dto.phone?.trim(),
      website: dto.website?.trim(),
      addressLine1: dto.addressLine1?.trim(),
      addressLine2: dto.addressLine2?.trim(),
      city: dto.city?.trim(),
      state: dto.state?.trim(),
      postalCode: dto.postalCode?.trim(),
      country: dto.country?.trim(),
      timezone: dto.timezone?.trim(),
      locale: dto.locale?.trim(),
      currency: dto.currency?.trim(),
      tenant: { connect: { id: auth.tenantId } },
    });

    return this.toDto(created, auth.tenantId);
  }

  async update(
    auth: AuthContext,
    id: string,
    dto: UpdateInstitutionDto,
  ): Promise<InstitutionResponseDto> {
    const existing = await this.repo.findByIdForTenant(id, auth.tenantId);
    if (!existing) {
      throw new NotFoundException({
        code: 'INSTITUTION_NOT_FOUND',
        message: 'Institution not found.',
      });
    }

    if (dto.institutionCode) {
      const code = dto.institutionCode.trim().toUpperCase();
      const clash = await this.repo.findByCodeForTenant(code, auth.tenantId);
      if (clash && clash.id !== id) {
        throw new ConflictException({
          code: 'INSTITUTION_CODE_EXISTS',
          message: 'An institution with this code already exists in your organization.',
        });
      }
    }

    const result = await this.repo.update(id, auth.tenantId, {
      ...(dto.institutionCode !== undefined && {
        institutionCode: dto.institutionCode.trim().toUpperCase(),
      }),
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.legalName !== undefined && { legalName: dto.legalName?.trim() }),
      ...(dto.institutionType !== undefined && {
        institutionType: dto.institutionType?.trim(),
      }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.email !== undefined && {
        email: dto.email?.trim().toLowerCase() ?? null,
      }),
      ...(dto.phone !== undefined && { phone: dto.phone?.trim() ?? null }),
      ...(dto.website !== undefined && { website: dto.website?.trim() ?? null }),
      ...(dto.addressLine1 !== undefined && {
        addressLine1: dto.addressLine1?.trim() ?? null,
      }),
      ...(dto.addressLine2 !== undefined && {
        addressLine2: dto.addressLine2?.trim() ?? null,
      }),
      ...(dto.city !== undefined && { city: dto.city?.trim() ?? null }),
      ...(dto.state !== undefined && { state: dto.state?.trim() ?? null }),
      ...(dto.postalCode !== undefined && {
        postalCode: dto.postalCode?.trim() ?? null,
      }),
      ...(dto.country !== undefined && { country: dto.country?.trim() ?? null }),
      ...(dto.timezone !== undefined && {
        timezone: dto.timezone?.trim() ?? null,
      }),
      ...(dto.locale !== undefined && { locale: dto.locale?.trim() ?? null }),
      ...(dto.currency !== undefined && {
        currency: dto.currency?.trim() ?? null,
      }),
    });

    if (result.count === 0) {
      throw new ForbiddenException({
        code: 'AUTH_TENANT_ACCESS_DENIED',
        message: 'Institution not found.',
      });
    }

    return this.getById(auth, id);
  }

  async archive(auth: AuthContext, id: string): Promise<{ message: string }> {
    const existing = await this.repo.findByIdForTenant(id, auth.tenantId);
    if (!existing) {
      throw new NotFoundException({
        code: 'INSTITUTION_NOT_FOUND',
        message: 'Institution not found.',
      });
    }
    await this.repo.archive(id, auth.tenantId);
    return { message: 'Institution archived.' };
  }

  private async toDto(
    row: {
      id: string;
      tenantId: string;
      institutionCode: string;
      name: string;
      legalName: string | null;
      institutionType: string | null;
      status: string;
      email: string | null;
      phone: string | null;
      website: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
      timezone: string | null;
      locale: string | null;
      currency: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    tenantId: string,
  ): Promise<InstitutionResponseDto> {
    const metrics = await this.repo.metricsForInstitution(row.id, tenantId);
    return {
      id: row.id,
      tenantId: row.tenantId,
      institutionCode: row.institutionCode,
      name: row.name,
      legalName: row.legalName,
      institutionType: row.institutionType,
      status: row.status,
      email: row.email,
      phone: row.phone,
      website: row.website,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      country: row.country,
      timezone: row.timezone,
      locale: row.locale,
      currency: row.currency,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      metrics,
    };
  }
}
