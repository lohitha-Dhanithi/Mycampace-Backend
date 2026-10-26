import { Injectable, ForbiddenException } from '@nestjs/common';
import { AdmissionService } from '../../admissions/services/admission.service';
import { InstitutionRepository } from '../../institution/repositories/institution.repository';
import { AuthorizationService } from '../../identity/services/authorization.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Executive dashboard view-model from real aggregates only.
 * Future: edu.sp_dashboard_executive_summary | edu.sp_dashboard_executive_metrics
 * Status: PLANNED — consolidated DB phase
 *
 * Does not invent students/faculty/revenue — those domains are not implemented.
 * Authorization uses dashboard.executive.read — NOT an EXECUTIVE RBAC role (PRD).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly admissions: AdmissionService,
    private readonly institutions: InstitutionRepository,
    private readonly authorization: AuthorizationService,
    private readonly prisma: PrismaService,
  ) {}

  async getExecutiveSummary(
    auth: AuthContext,
    institutionId?: string,
  ): Promise<Record<string, unknown>> {
    if (institutionId) {
      const inst = await this.institutions.findByIdForTenant(
        institutionId,
        auth.tenantId,
      );
      if (!inst) {
        throw new ForbiddenException({
          code: 'AUTH_TENANT_ACCESS_DENIED',
          message: 'Institution not found in your organization.',
        });
      }
    }

    const permissions = await this.authorization
      .getSnapshot(auth.userId, auth.tenantId)
      .then((s) => s.permissions);

    const campusAssignments = await this.prisma.userCampusAssignment.findMany({
      where: { userId: auth.userId, tenantId: auth.tenantId, status: 'ACTIVE' },
      select: { campusId: true },
    });
    const assignedCampusIds = campusAssignments.map((c) => c.campusId);
    // Group leadership (no campus assignment) = tenant-wide; assigned campuses = constrained.
    const isCampusConstrained = assignedCampusIds.length > 0;

    const canReadInstitutions = permissions.includes('institution.read');
    const canReadAdmissions = permissions.includes('admission.read');
    const canReadUsers = permissions.includes('identity.user.read');

    // Institutions (real)
    let institutionSummary: {
      total: number;
      byStatus: Record<string, number>;
      items: Array<{
        id: string;
        name: string;
        institutionCode: string;
        status: string;
        applications: number;
      }>;
    } | null = null;

    if (canReadInstitutions) {
      const rows = institutionId
        ? [
            await this.institutions.findByIdForTenant(
              institutionId,
              auth.tenantId,
            ),
          ].filter(Boolean)
        : await this.institutions.listByTenant(auth.tenantId);

      const byStatus: Record<string, number> = {};
      const items = [];
      for (const r of rows) {
        if (!r) continue;
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        const metrics = await this.institutions.metricsForInstitution(
          r.id,
          auth.tenantId,
        );
        items.push({
          id: r.id,
          name: r.name,
          institutionCode: r.institutionCode,
          status: r.status,
          applications: metrics.applications,
        });
      }
      institutionSummary = {
        total: items.length,
        byStatus,
        items,
      };
    }

    // Admissions (real via existing AdmissionService)
    let applications: {
      total: number;
      byStatus: Record<string, number>;
    } | null = null;
    if (canReadAdmissions) {
      applications = await this.admissions.metrics(auth, institutionId);
    }

    // Active users in tenant (real User table) — only if permitted
    let users: { totalActive: number } | null = null;
    if (canReadUsers) {
      const totalActive = await this.prisma.user.count({
        where: {
          tenantId: auth.tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          ...(institutionId
            ? {} // User is tenant-scoped today; institution membership deferred
            : {}),
        },
      });
      users = { totalActive };
    }

    return {
      scope: {
        tenantId: auth.tenantId,
        institutionId: institutionId || null,
        level: institutionId
          ? 'INSTITUTION'
          : isCampusConstrained
            ? 'CAMPUS'
            : 'GROUP',
        campusIds: assignedCampusIds,
        campusConstrained: isCampusConstrained,
      },
      generatedAt: new Date().toISOString(),
      institutions: institutionSummary,
      applications,
      users,
      deferred: {
        campusScope:
          'CAMPUS_SCOPE_DEFERRED — Principal campus-limited executive view requires user-campus assignment after Campus ABAC wiring',

        students:
          'NOT AVAILABLE — Student SIS entity not implemented (Sprint later)',
        faculty:
          'NOT AVAILABLE — Faculty staffing entity not implemented',
        revenue: 'NOT AVAILABLE — Finance module not implemented',
        attendance: 'NOT AVAILABLE — Attendance module not implemented',
        hostel: 'NOT AVAILABLE — Hostel module not implemented',
        transport: 'NOT AVAILABLE — Transport module not implemented',
      },
      permissions: {
        'institution.read': canReadInstitutions,
        'admission.read': canReadAdmissions,
        'identity.user.read': canReadUsers,
      },
    };
  }
}
