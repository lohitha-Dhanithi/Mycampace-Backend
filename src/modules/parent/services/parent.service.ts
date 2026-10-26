import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ParentRepository } from '../repositories/parent.repository';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import { AuditService } from '../../audit/services/audit.service';

@Injectable()
export class ParentService {
  constructor(
    private readonly repo: ParentRepository,
    private readonly audit: AuditService,
  ) {}

  async listStudents(auth: AuthContext) {
    const links = await this.repo.listActiveStudentsForParent(
      auth.userId,
      auth.tenantId,
    );
    return links.map((l) => ({
      relationshipId: l.id,
      relationshipType: l.relationshipType,
      status: l.status,
      student: {
        id: l.studentUser.id,
        email: l.studentUser.email,
        status: l.studentUser.status,
        personaType: l.studentUser.personaType,
      },
      institution: l.institution
        ? {
            id: l.institution.id,
            name: l.institution.name,
            institutionCode: l.institution.institutionCode,
          }
        : null,
    }));
  }

  async getStudent(auth: AuthContext, studentId: string) {
    const link = await this.repo.findActiveLink(
      auth.userId,
      studentId,
      auth.tenantId,
    );
    if (!link) {
      throw new NotFoundException({
        code: 'PARENT_STUDENT_NOT_FOUND',
        message: 'Student not found in your linked accounts.',
      });
    }
    const students = await this.listStudents(auth);
    return students.find((s) => s.student.id === studentId);
  }

  async listAdmissions(auth: AuthContext, studentId?: string) {
    const links = await this.repo.listActiveStudentsForParent(
      auth.userId,
      auth.tenantId,
    );
    const studentIds = links.map((l) => l.studentUser.id);

    if (studentId) {
      if (!studentIds.includes(studentId)) {
        throw new ForbiddenException({
          code: 'AUTH_TENANT_ACCESS_DENIED',
          message: 'Student not linked to your account.',
        });
      }
    }

    const rows = await this.repo.listAdmissionsForStudentIds(
      auth.tenantId,
      studentIds,
      studentId,
    );

    return rows.map((r) => this.toAdmissionDto(r));
  }

  async getAdmission(auth: AuthContext, admissionId: string) {
    const links = await this.repo.listActiveStudentsForParent(
      auth.userId,
      auth.tenantId,
    );
    const studentIds = links.map((l) => l.studentUser.id);
    const row = await this.repo.findAdmissionForParent(
      admissionId,
      auth.tenantId,
      studentIds,
    );
    if (!row) {
      throw new NotFoundException({
        code: 'ADMISSION_NOT_FOUND',
        message: 'Application not found.',
      });
    }
    return this.toAdmissionDto(row);
  }


  /** Admin: create parent–student relationship (never public self-link). */
  async createRelationship(
    auth: AuthContext,
    dto: {
      parentUserId: string;
      studentUserId: string;
      relationshipType: string;
      institutionId?: string;
      status?: 'PENDING' | 'ACTIVE';
    },
  ) {
    if (dto.parentUserId === dto.studentUserId) {
      throw new BadRequestException({
        code: 'RELATIONSHIP_INVALID',
        message: 'Parent and student must be different users.',
      });
    }
    const parent = await this.repo.findUserInTenant(
      dto.parentUserId,
      auth.tenantId,
    );
    const student = await this.repo.findUserInTenant(
      dto.studentUserId,
      auth.tenantId,
    );
    if (!parent || !student) {
      throw new ForbiddenException({
        code: 'AUTH_TENANT_ACCESS_DENIED',
        message: 'Parent or student not found in your organization.',
      });
    }
    const existing = await this.repo.findRelationship(
      auth.tenantId,
      dto.parentUserId,
      dto.studentUserId,
    );
    if (existing) {
      throw new ConflictException({
        code: 'RELATIONSHIP_EXISTS',
        message: 'A relationship already exists for this parent and student.',
      });
    }
    const status = dto.status ?? 'ACTIVE';
    const created = await this.repo.createRelationship({
      tenantId: auth.tenantId,
      parentUserId: dto.parentUserId,
      studentUserId: dto.studentUserId,
      relationshipType: dto.relationshipType.trim().toUpperCase(),
      status,
      institutionId: dto.institutionId,
    });
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'parent.relationship.create',
      module: 'parent',
      entityType: 'ParentStudentRelationship',
      entityId: created.id,
      metadata: { status, relationshipType: created.relationshipType },
    });
    return {
      id: created.id,
      parentUserId: created.parentUserId,
      studentUserId: created.studentUserId,
      relationshipType: created.relationshipType,
      status: created.status,
      institutionId: created.institutionId,
    };
  }

  async updateRelationshipStatus(
    auth: AuthContext,
    id: string,
    status: string,
  ) {
    const existing = await this.repo.findRelationshipById(id, auth.tenantId);
    if (!existing) {
      throw new NotFoundException({
        code: 'RELATIONSHIP_NOT_FOUND',
        message: 'Relationship not found.',
      });
    }
    await this.repo.updateRelationshipStatus(id, auth.tenantId, status);
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: `parent.relationship.${status.toLowerCase()}`,
      module: 'parent',
      entityType: 'ParentStudentRelationship',
      entityId: id,
      metadata: { status },
    });
    return { id, status };
  }

  async listRelationships(auth: AuthContext) {
    const rows = await this.repo.listRelationshipsForTenant(auth.tenantId);
    return rows.map((r) => ({
      id: r.id,
      relationshipType: r.relationshipType,
      status: r.status,
      parent: r.parentUser,
      student: r.studentUser,
      institutionId: r.institutionId,
    }));
  }

  private toAdmissionDto(row: {
    id: string;
    applicationNo: string;
    status: string;
    firstName: string;
    lastName: string;
    email: string;
    programApplied: string | null;
    academicYear: string | null;
    submittedAt: Date | null;
    institution?: { id: string; name: string; institutionCode: string } | null;
  }) {
    const roadmap = [
      { key: 'SUBMITTED', label: 'Application submitted', done: true },
      {
        key: 'UNDER_REVIEW',
        label: 'Under review',
        done: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED'].includes(row.status),
      },
      {
        key: 'DECISION',
        label: 'Admission decision',
        done: ['ACCEPTED', 'REJECTED'].includes(row.status),
      },
    ];
    return {
      id: row.id,
      applicationNo: row.applicationNo,
      status: row.status,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      programApplied: row.programApplied,
      academicYear: row.academicYear,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      institution: row.institution
        ? {
            id: row.institution.id,
            name: row.institution.name,
            institutionCode: row.institution.institutionCode,
          }
        : null,
      roadmap,
      deferred: {
        fees: 'Fee status not available — Finance module deferred',
        documents: 'Document status not available — Document domain deferred',
        academicRecords: 'Academic records not available — SIS deferred',
      },
    };
  }
}
