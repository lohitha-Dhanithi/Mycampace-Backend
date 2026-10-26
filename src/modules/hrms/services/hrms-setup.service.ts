import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { HrmsSetupRepository } from '../repositories/hrms-setup.repository';
import { AuditService } from '../../audit/services/audit.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import {
  CreateCategoryDto,
  CreateHrmsDepartmentDto,
  CreateLeaveTypeDto,
  ReplaceMetricTemplatesDto,
  UpdateCategoryDto,
  UpdateHrmsDepartmentDto,
  UpdateLeaveTypeDto,
} from '../dto/hrms-setup.dto';

const DEFAULT_LEAVE_TYPES = [
  { code: 'CASUAL', name: 'Casual Leave', defaultEntitlement: 12, deductsBalance: true },
  { code: 'SICK', name: 'Sick Leave', defaultEntitlement: 8, deductsBalance: true },
  { code: 'EARNED', name: 'Earned Leave', defaultEntitlement: 12, deductsBalance: true },
  { code: 'ON_DUTY', name: 'On Duty', defaultEntitlement: null, deductsBalance: false },
  { code: 'COMP_OFF', name: 'Compensatory Off', defaultEntitlement: null, deductsBalance: false },
];

const DEFAULT_METRICS = {
  teaching: [
    ['Teaching effectiveness', 30],
    ['Student feedback', 20],
    ['Subject results', 20],
    ['Punctuality & attendance', 15],
    ['Professional development', 15],
  ],
  nonTeaching: [
    ['Service quality', 30],
    ['Process compliance', 25],
    ['Attendance reliability', 25],
    ['Peer feedback', 20],
  ],
} as const;

@Injectable()
export class HrmsSetupService {
  constructor(
    private readonly repo: HrmsSetupRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * First-use defaults for a tenant: Teaching / Non-Teaching categories, standard leave types and
   * appraisal metric templates. Only runs while the tenant has no categories at all.
   */
  async ensureDefaults(tenantId: string) {
    if ((await this.repo.listCategories(tenantId)).length > 0) return;
    const teaching = await this.repo.createCategory({ tenantId, name: 'Teaching', isTeaching: true });
    const nonTeaching = await this.repo.createCategory({ tenantId, name: 'Non-Teaching', isTeaching: false });
    if ((await this.repo.listLeaveTypes(tenantId)).length === 0) {
      for (const t of DEFAULT_LEAVE_TYPES) {
        await this.repo.createLeaveType({ tenantId, ...t });
      }
    }
    await this.repo.replaceMetricTemplates(
      tenantId,
      teaching.id,
      DEFAULT_METRICS.teaching.map(([name, weight]) => ({ name, weight })),
    );
    await this.repo.replaceMetricTemplates(
      tenantId,
      nonTeaching.id,
      DEFAULT_METRICS.nonTeaching.map(([name, weight]) => ({ name, weight })),
    );
  }

  // ---- Categories ----
  async listCategories(auth: AuthContext) {
    await this.ensureDefaults(auth.tenantId);
    return this.repo.listCategories(auth.tenantId);
  }

  async createCategory(auth: AuthContext, dto: CreateCategoryDto) {
    const name = dto.name.trim();
    if (await this.repo.findCategoryByName(auth.tenantId, name)) {
      throw new ConflictException({ code: 'HRMS_CATEGORY_EXISTS', message: 'A category with this name already exists.' });
    }
    const row = await this.repo.createCategory({ tenantId: auth.tenantId, name, isTeaching: dto.isTeaching ?? false });
    await this.log(auth, 'hrms.category.create', 'HrmsCategory', row.id);
    return row;
  }

  async updateCategory(auth: AuthContext, id: string, dto: UpdateCategoryDto) {
    if (!(await this.repo.findCategory(id, auth.tenantId))) {
      throw new NotFoundException({ code: 'HRMS_CATEGORY_NOT_FOUND', message: 'Category not found.' });
    }
    if (dto.name) {
      const clash = await this.repo.findCategoryByName(auth.tenantId, dto.name.trim());
      if (clash && clash.id !== id) {
        throw new ConflictException({ code: 'HRMS_CATEGORY_EXISTS', message: 'A category with this name already exists.' });
      }
    }
    await this.repo.updateCategory(id, auth.tenantId, {
      ...(dto.name ? { name: dto.name.trim() } : {}),
      ...(dto.isTeaching !== undefined ? { isTeaching: dto.isTeaching } : {}),
    });
    await this.log(auth, 'hrms.category.update', 'HrmsCategory', id);
    return this.repo.findCategory(id, auth.tenantId);
  }

  // ---- Departments ----
  async listDepartments(auth: AuthContext) {
    await this.ensureDefaults(auth.tenantId);
    return this.repo.listDepartments(auth.tenantId);
  }

  async createDepartment(auth: AuthContext, dto: CreateHrmsDepartmentDto) {
    const name = dto.name.trim();
    if (await this.repo.findDepartmentByName(auth.tenantId, name)) {
      throw new ConflictException({ code: 'HRMS_DEPARTMENT_EXISTS', message: 'A department with this name already exists.' });
    }
    await this.assertDepartmentRefs(auth.tenantId, dto);
    const row = await this.repo.createDepartment({
      tenantId: auth.tenantId,
      name,
      academicDepartmentId: dto.academicDepartmentId,
      headStaffId: dto.headStaffId,
    });
    await this.log(auth, 'hrms.department.create', 'HrmsDepartment', row.id);
    return row;
  }

  async updateDepartment(auth: AuthContext, id: string, dto: UpdateHrmsDepartmentDto) {
    if (!(await this.repo.findDepartment(id, auth.tenantId))) {
      throw new NotFoundException({ code: 'HRMS_DEPARTMENT_NOT_FOUND', message: 'Department not found.' });
    }
    if (dto.name) {
      const clash = await this.repo.findDepartmentByName(auth.tenantId, dto.name.trim());
      if (clash && clash.id !== id) {
        throw new ConflictException({ code: 'HRMS_DEPARTMENT_EXISTS', message: 'A department with this name already exists.' });
      }
    }
    await this.assertDepartmentRefs(auth.tenantId, dto);
    await this.repo.updateDepartment(id, auth.tenantId, {
      ...(dto.name ? { name: dto.name.trim() } : {}),
      ...(dto.academicDepartmentId !== undefined ? { academicDepartmentId: dto.academicDepartmentId } : {}),
      ...(dto.headStaffId !== undefined ? { headStaffId: dto.headStaffId } : {}),
    });
    await this.log(auth, 'hrms.department.update', 'HrmsDepartment', id);
    return this.repo.findDepartment(id, auth.tenantId);
  }

  private async assertDepartmentRefs(tenantId: string, dto: { academicDepartmentId?: string; headStaffId?: string }) {
    if (dto.headStaffId && !(await this.repo.findStaffInTenant(dto.headStaffId, tenantId))) {
      throw new BadRequestException({ code: 'HRMS_STAFF_NOT_FOUND', message: 'Department head not found in your tenant.' });
    }
    if (dto.academicDepartmentId && !(await this.repo.findAcademicDepartment(dto.academicDepartmentId, tenantId))) {
      throw new BadRequestException({ code: 'ACADEMIC_DEPARTMENT_NOT_FOUND', message: 'Academic department not found.' });
    }
  }

  // ---- Leave types ----
  async listLeaveTypes(auth: AuthContext) {
    await this.ensureDefaults(auth.tenantId);
    return this.repo.listLeaveTypes(auth.tenantId);
  }

  async createLeaveType(auth: AuthContext, dto: CreateLeaveTypeDto) {
    const code = dto.code.trim().toUpperCase();
    if (await this.repo.findLeaveTypeByCode(auth.tenantId, code)) {
      throw new ConflictException({ code: 'HRMS_LEAVE_TYPE_EXISTS', message: 'A leave type with this code already exists.' });
    }
    const row = await this.repo.createLeaveType({
      tenantId: auth.tenantId,
      code,
      name: dto.name.trim(),
      defaultEntitlement: dto.defaultEntitlement,
      deductsBalance: dto.deductsBalance ?? dto.defaultEntitlement !== undefined,
    });
    await this.log(auth, 'hrms.leave_type.create', 'LeaveType', row.id);
    return row;
  }

  async updateLeaveType(auth: AuthContext, id: string, dto: UpdateLeaveTypeDto) {
    if (!(await this.repo.findLeaveType(id, auth.tenantId))) {
      throw new NotFoundException({ code: 'HRMS_LEAVE_TYPE_NOT_FOUND', message: 'Leave type not found.' });
    }
    if (dto.code) {
      const clash = await this.repo.findLeaveTypeByCode(auth.tenantId, dto.code.trim());
      if (clash && clash.id !== id) {
        throw new ConflictException({ code: 'HRMS_LEAVE_TYPE_EXISTS', message: 'A leave type with this code already exists.' });
      }
    }
    await this.repo.updateLeaveType(id, auth.tenantId, {
      ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.name ? { name: dto.name.trim() } : {}),
      ...(dto.defaultEntitlement !== undefined ? { defaultEntitlement: dto.defaultEntitlement } : {}),
      ...(dto.deductsBalance !== undefined ? { deductsBalance: dto.deductsBalance } : {}),
    });
    await this.log(auth, 'hrms.leave_type.update', 'LeaveType', id);
    return this.repo.findLeaveType(id, auth.tenantId);
  }

  // ---- Appraisal metric templates ----
  async getMetricTemplates(auth: AuthContext, categoryId: string) {
    await this.ensureDefaults(auth.tenantId);
    await this.assertCategory(auth.tenantId, categoryId);
    return this.repo.listMetricTemplates(auth.tenantId, categoryId);
  }

  async replaceMetricTemplates(auth: AuthContext, categoryId: string, dto: ReplaceMetricTemplatesDto) {
    await this.assertCategory(auth.tenantId, categoryId);
    const metrics = dto.metrics ?? [];
    const total = metrics.reduce((sum, m) => sum + m.weight, 0);
    if (metrics.length === 0 || total !== 100) {
      throw new BadRequestException({ code: 'HRMS_METRIC_WEIGHTS_INVALID', message: 'Provide at least one metric; weights must total 100.' });
    }
    if (new Set(metrics.map((m) => m.name.trim().toLowerCase())).size !== metrics.length) {
      throw new BadRequestException({ code: 'HRMS_METRIC_DUPLICATE', message: 'Metric names must be unique.' });
    }
    await this.repo.replaceMetricTemplates(
      auth.tenantId,
      categoryId,
      metrics.map((m) => ({ name: m.name.trim(), weight: m.weight })),
    );
    await this.log(auth, 'hrms.metric_template.replace', 'HrmsCategory', categoryId);
    return this.repo.listMetricTemplates(auth.tenantId, categoryId);
  }

  private async assertCategory(tenantId: string, categoryId: string) {
    if (!(await this.repo.findCategory(categoryId, tenantId))) {
      throw new NotFoundException({ code: 'HRMS_CATEGORY_NOT_FOUND', message: 'Category not found.' });
    }
  }

  private log(auth: AuthContext, action: string, entityType: string, entityId: string) {
    return this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action,
      module: 'hrms',
      entityType,
      entityId,
    });
  }
}
