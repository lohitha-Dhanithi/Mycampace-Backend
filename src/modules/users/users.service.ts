// backend/src/modules/users/users.service.ts
import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { PlatformRole } from '@prisma/client'
import { PrismaService } from '@/prisma/prisma.service'
import { RedisCacheService } from '@/cache/redis-cache.service'
import { AuthenticatedUser } from '@/common/auth/current-user.decorator'

export interface CreateUserDto {
  name: string
  email: string
  mobile?: string
  organizationId?: string
  campusId?: string
  assignedCampusIds?: string[]
  platformRole?: PlatformRole | string
  productRoles?: Record<string, string>
  status?: string
}

export interface CreateRoleDto {
  name: string
  description?: string
  productId: string
  organizationId?: string
  permissions: string[]
}

export interface UpdateRoleDto {
  name?: string
  description?: string
  permissions?: string[]
  status?: string
}

const SYSTEM_ROLE_TEMPLATES = [
  {
    id: 'role-sys-acad-dir',
    name: 'Academic Director',
    description: 'Executive governance across degree programs and faculty workloads.',
    productId: 'academics',
    organizationId: null,
    isSystem: true,
    status: 'Active',
    permissions: [
      'academics.programs.view',
      'academics.programs.create',
      'academics.programs.update',
      'academics.courses.manage',
      'academics.timetable.manage',
    ],
  },
  {
    id: 'role-sys-principal',
    name: 'Principal',
    description: 'Campus executive authority for timetable approvals and section structures.',
    productId: 'academics',
    organizationId: null,
    isSystem: true,
    status: 'Active',
    permissions: [
      'academics.programs.view',
      'academics.courses.manage',
      'academics.timetable.manage',
    ],
  },
  {
    id: 'role-sys-teacher',
    name: 'Teacher / Faculty',
    description: 'Instructional staff managing assigned courses and class attendance.',
    productId: 'academics',
    organizationId: null,
    isSystem: true,
    status: 'Active',
    permissions: ['academics.programs.view', 'academics.courses.view', 'academics.timetable.view'],
  },
  {
    id: 'role-sys-lms-admin',
    name: 'LMS Administrator',
    description: 'Digital campus management, quizzes, and assessment rubrics.',
    productId: 'lms',
    organizationId: null,
    isSystem: true,
    status: 'Active',
    permissions: ['lms.courses.manage', 'lms.assignments.grade', 'lms.quizzes.manage'],
  },
  {
    id: 'role-sys-fin-ctrl',
    name: 'Finance Controller',
    description: 'Full institutional ledger, fee structures, and collection oversight.',
    productId: 'finance',
    organizationId: null,
    isSystem: true,
    status: 'Active',
    permissions: ['finance.fee_structures.manage', 'finance.invoices.manage', 'finance.reports.export'],
  },
  {
    id: 'role-sys-adm-head',
    name: 'Head of Admissions',
    description: 'Recruitment pipeline governance, merit lists, and seat allocation.',
    productId: 'admissions',
    organizationId: null,
    isSystem: true,
    status: 'Active',
    permissions: ['admissions.leads.manage', 'admissions.applications.approve', 'admissions.reports.export'],
  },
  {
    id: 'role-sys-hrms-admin',
    name: 'HR Administrator',
    description: 'Staff directory, leave policies, and institutional records.',
    productId: 'hrms',
    organizationId: null,
    isSystem: true,
    status: 'Active',
    permissions: ['hrms.staff.manage', 'hrms.leave.approve', 'hrms.attendance.manage'],
  },
]

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  // In-memory fallback if database is in lazy mock mode
  private inMemoryUsers: any[] = [
    {
      id: 'usr-1',
      name: 'Vikram Aditya',
      email: 'vikram.aditya@abcschool.edu.in',
      mobile: '+91 98480 12345',
      organizationId: 'org-1',
      campusId: 'camp-1',
      assignedCampusIds: ['camp-1', 'camp-2'],
      platformRole: 'OrganizationAdmin' as PlatformRole,
      status: 'Active',
      productRoles: {
        academics: 'Academic Director',
        lms: 'LMS Administrator',
        finance: 'Finance Controller',
        admissions: 'Head of Admissions',
        hrms: 'HR Administrator',
      },
    },
    {
      id: 'usr-2',
      name: 'Dr. Meenakshi Sundaram',
      email: 'meenakshi.s@abcschool.edu.in',
      mobile: '+91 98480 23456',
      organizationId: 'org-1',
      campusId: 'camp-1',
      assignedCampusIds: ['camp-1'],
      platformRole: 'Member' as PlatformRole,
      status: 'Active',
      productRoles: {
        academics: 'Principal',
        lms: 'Instructor',
        finance: 'Viewer',
      },
    },
    {
      id: 'usr-3',
      name: 'Ananya Sharma',
      email: 'ananya.sharma@abcschool.edu.in',
      mobile: '+91 98480 34567',
      organizationId: 'org-1',
      campusId: 'camp-1',
      assignedCampusIds: ['camp-1'],
      platformRole: 'Member' as PlatformRole,
      status: 'Active',
      productRoles: {
        academics: 'Teacher / Faculty',
        admissions: 'Admissions Officer',
      },
    },
  ]

  private inMemoryCustomRoles: any[] = []

  // -------------------------------------------------------------
  // 1. GET USERS (WITH TENANT & CAMPUS SCOPING)
  // -------------------------------------------------------------
  async getUsers(
    filter: {
      organizationId?: string
      campusId?: string
      product?: string
      search?: string
      role?: string
    } = {},
    currentUser?: AuthenticatedUser,
  ) {
    const isSuperAdmin = currentUser?.platformRole === 'SuperAdmin' || currentUser?.platformRole === PlatformRole.SuperAdmin
    const targetOrgId = isSuperAdmin && filter.organizationId ? filter.organizationId : currentUser?.organizationId || filter.organizationId || 'org-1'

    try {
      const dbUsers = await this.prisma.user.findMany({
        where: {
          organizationId: targetOrgId,
          ...(filter.campusId ? { campusId: filter.campusId } : {}),
          ...(filter.role ? { platformRole: filter.role as PlatformRole } : {}),
        },
        include: {
          productRoles: true,
          campus: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      if (dbUsers.length > 0) {
        let mapped = dbUsers.map((u) => {
          const rolesMap: Record<string, string> = {}
          for (const pr of u.productRoles) {
            rolesMap[pr.productId] = pr.roleName
          }
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            mobile: u.mobile,
            organizationId: u.organizationId,
            campusId: u.campusId,
            assignedCampusIds: u.assignedCampusIds,
            platformRole: u.platformRole,
            status: u.status,
            productRoles: rolesMap,
            campusName: u.campus?.name,
          }
        })

        if (filter.product && filter.product !== 'all') {
          mapped = mapped.filter((u) => u.productRoles[filter.product])
        }
        if (filter.search) {
          const q = filter.search.toLowerCase()
          mapped = mapped.filter(
            (u) =>
              u.name.toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q) ||
              (u.mobile && u.mobile.includes(q)),
          )
        }
        return mapped
      }
    } catch (e) {
      // Fallback to in-memory store
    }

    let list = this.inMemoryUsers.filter((u) => u.organizationId === targetOrgId)
    if (filter.product && filter.product !== 'all') {
      list = list.filter((u) => u.productRoles[filter.product])
    }
    if (filter.role && filter.role !== 'all') {
      list = list.filter((u) => u.platformRole === filter.role)
    }
    if (filter.search) {
      const q = filter.search.toLowerCase()
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.mobile && u.mobile.includes(q)),
      )
    }
    return list
  }

  // -------------------------------------------------------------
  // 2. CREATE USER (PRIVILEGE ESCALATION & ENTITLEMENT PROTECTED)
  // -------------------------------------------------------------
  async createUser(dto: CreateUserDto, currentUser?: AuthenticatedUser) {
    const isSuperAdmin = currentUser?.platformRole === 'SuperAdmin' || currentUser?.platformRole === PlatformRole.SuperAdmin
    const isOrgAdmin = currentUser?.platformRole === 'OrganizationAdmin' || currentUser?.platformRole === PlatformRole.OrganizationAdmin
    const isCampusAdmin = currentUser?.platformRole === 'CampusAdmin' || currentUser?.platformRole === PlatformRole.CampusAdmin

    const requestedRole = dto.platformRole || 'Member'

    // Privilege Escalation Safeguards:
    if ((requestedRole === 'SuperAdmin' || requestedRole === PlatformRole.SuperAdmin) && !isSuperAdmin) {
      throw new ForbiddenException('Only a verified Super Admin can create or assign Super Admin authority.')
    }

    if ((requestedRole === 'OrganizationAdmin' || requestedRole === PlatformRole.OrganizationAdmin) && !isSuperAdmin && !isOrgAdmin) {
      throw new ForbiddenException('Only Organization Admins or Super Admins can assign Organization Admin authority.')
    }

    if (isCampusAdmin && requestedRole !== 'Member') {
      throw new ForbiddenException('Campus Admins can only create Member accounts within their campus scope.')
    }

    const targetOrgId = isSuperAdmin && dto.organizationId ? dto.organizationId : currentUser?.organizationId || dto.organizationId || 'org-1'

    // Campus Scope Enforcement for CampusAdmin
    let targetCampusIds = dto.assignedCampusIds || (dto.campusId ? [dto.campusId] : [])
    if (isCampusAdmin && currentUser?.organizationId) {
      if (targetCampusIds.length === 0) {
        throw new BadRequestException('Campus Admin must specify at least one authorized campus for this user.')
      }
    }

    // Product Entitlement Verification:
    // Ensure all assigned product roles belong to products currently active or trial for this organization
    if (dto.productRoles && !isSuperAdmin) {
      await this.validateProductEntitlements(targetOrgId, Object.keys(dto.productRoles))
    }

    try {
      const newUser = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: dto.name.trim(),
            email: dto.email.toLowerCase().trim(),
            mobile: dto.mobile?.trim(),
            organizationId: targetOrgId,
            campusId: dto.campusId,
            assignedCampusIds: targetCampusIds,
            platformRole: (dto.platformRole as PlatformRole) || PlatformRole.Member,
            status: dto.status || 'Active',
          },
        })

        if (dto.productRoles) {
          for (const [prodId, roleName] of Object.entries(dto.productRoles)) {
            if (roleName && roleName !== 'No Access') {
              await tx.userProductRole.create({
                data: {
                  userId: user.id,
                  productId: prodId,
                  roleName: String(roleName),
                },
              })
            }
          }
        }

        // Record Audit Log
        await tx.auditLog.create({
          data: {
            organizationId: targetOrgId,
            userId: currentUser?.userId || user.id,
            action: 'USER_CREATED',
            product: 'platform-identity',
            details: `User ${dto.email} created with authority ${dto.platformRole || 'Member'}.`,
          },
        })

        return user
      })

      return newUser
    } catch (e: any) {
      // In-memory fallback
      const inMemoryUser = {
        id: `usr-${Date.now()}`,
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        mobile: dto.mobile?.trim() || '',
        organizationId: targetOrgId,
        campusId: dto.campusId,
        assignedCampusIds: targetCampusIds,
        platformRole: (dto.platformRole as PlatformRole) || PlatformRole.Member,
        status: dto.status || 'Active',
        productRoles: dto.productRoles || {},
      }
      this.inMemoryUsers.unshift(inMemoryUser)
      return inMemoryUser
    }
  }

  // -------------------------------------------------------------
  // 3. UPDATE USER PRODUCT ROLES & PLATFORM AUTHORITY
  // -------------------------------------------------------------
  async updateUserProductRoles(
    userId: string,
    productRoles: Record<string, string>,
    platformRole?: string,
    currentUser?: AuthenticatedUser,
  ) {
    const isSuperAdmin = currentUser?.platformRole === 'SuperAdmin' || currentUser?.platformRole === PlatformRole.SuperAdmin

    // SuperAdmin protection
    if (platformRole === 'SuperAdmin' && !isSuperAdmin) {
      throw new ForbiddenException('Only a verified Super Admin can grant Super Admin authority.')
    }

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
      })

      if (existingUser) {
        if (!isSuperAdmin && currentUser && existingUser.organizationId !== currentUser.organizationId) {
          throw new ForbiddenException('Cannot modify users belonging to another organization.')
        }

        // Validate entitlements for all products being granted
        if (productRoles && !isSuperAdmin) {
          await this.validateProductEntitlements(existingUser.organizationId, Object.keys(productRoles))
        }

        await this.prisma.$transaction(async (tx) => {
          if (platformRole) {
            await tx.user.update({
              where: { id: userId },
              data: { platformRole: platformRole as PlatformRole },
            })
          }

          for (const [prodId, roleName] of Object.entries(productRoles)) {
            if (roleName === 'No Access') {
              await tx.userProductRole.deleteMany({
                where: { userId, productId: prodId },
              })
            } else {
              await tx.userProductRole.upsert({
                where: {
                  userId_productId: { userId, productId: prodId },
                },
                update: { roleName: String(roleName) },
                create: {
                  userId,
                  productId: prodId,
                  roleName: String(roleName),
                },
              })
            }
          }

          // Audit Log
          await tx.auditLog.create({
            data: {
              organizationId: existingUser.organizationId,
              userId: currentUser?.userId,
              action: 'USER_ROLES_UPDATED',
              product: 'platform-identity',
              details: `Updated product roles and platform authority for user ${existingUser.email}.`,
            },
          })
        })

        // Invalidate session cache
        await this.cache.del(`user:session:${existingUser.email}`)
        return { success: true, userId }
      }
    } catch (e) {
      // In-memory fallback
    }

    const user = this.inMemoryUsers.find((u) => u.id === userId)
    if (user) {
      if (platformRole) user.platformRole = platformRole as PlatformRole
      user.productRoles = { ...user.productRoles, ...productRoles }
      await this.cache.del(`user:session:${user.email}`)
    }
    return user
  }

  // -------------------------------------------------------------
  // 4. CUSTOM PRODUCT ROLES & PERMISSION MANAGEMENT
  // -------------------------------------------------------------
  async getRoles(
    filter: { productId?: string; organizationId?: string } = {},
    currentUser?: AuthenticatedUser,
  ) {
    const isSuperAdmin = currentUser?.platformRole === 'SuperAdmin' || currentUser?.platformRole === PlatformRole.SuperAdmin
    const targetOrgId = isSuperAdmin && filter.organizationId ? filter.organizationId : currentUser?.organizationId || filter.organizationId || 'org-1'

    try {
      const dbRoles = await this.prisma.role.findMany({
        where: {
          OR: [{ isSystem: true }, { organizationId: targetOrgId }],
          ...(filter.productId && filter.productId !== 'all' ? { productId: filter.productId } : {}),
        },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      })

      if (dbRoles.length > 0) return dbRoles
    } catch (e) {}

    // Return combined system templates and in-memory custom roles
    let list = [...SYSTEM_ROLE_TEMPLATES, ...this.inMemoryCustomRoles]
    if (filter.productId && filter.productId !== 'all') {
      list = list.filter((r) => r.productId === filter.productId)
    }
    return list.filter((r) => r.isSystem || r.organizationId === targetOrgId)
  }

  async createCustomRole(dto: CreateRoleDto, currentUser?: AuthenticatedUser) {
    const targetOrgId = currentUser?.organizationId || dto.organizationId || 'org-1'

    // Prevent non-admin users from creating roles
    const isMember = currentUser?.platformRole === 'Member' || currentUser?.platformRole === PlatformRole.Member
    if (isMember) {
      throw new ForbiddenException('Members cannot create or configure custom product roles.')
    }

    try {
      const newRole = await this.prisma.role.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim(),
          productId: dto.productId,
          organizationId: targetOrgId,
          isSystem: false,
          status: 'Active',
          permissions: dto.permissions || [],
        },
      })

      await this.prisma.auditLog.create({
        data: {
          organizationId: targetOrgId,
          userId: currentUser?.userId,
          action: 'CUSTOM_ROLE_CREATED',
          product: dto.productId,
          details: `Custom role "${dto.name}" created with ${dto.permissions?.length || 0} permissions.`,
        },
      })

      return newRole
    } catch (e: any) {
      const inMem = {
        id: `role-custom-${Date.now()}`,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        productId: dto.productId,
        organizationId: targetOrgId,
        isSystem: false,
        status: 'Active',
        permissions: dto.permissions || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      this.inMemoryCustomRoles.push(inMem)
      return inMem
    }
  }

  async updateCustomRole(id: string, updates: UpdateRoleDto, currentUser?: AuthenticatedUser) {
    try {
      const existing = await this.prisma.role.findUnique({ where: { id } })
      if (!existing) throw new NotFoundException('Role not found')

      if (existing.isSystem && updates.name && updates.name !== existing.name) {
        throw new BadRequestException('System-defined default template titles cannot be renamed.')
      }

      const updated = await this.prisma.role.update({
        where: { id },
        data: {
          name: updates.name,
          description: updates.description,
          permissions: updates.permissions,
          status: updates.status,
        },
      })

      await this.prisma.auditLog.create({
        data: {
          organizationId: existing.organizationId || 'org-1',
          userId: currentUser?.userId,
          action: 'CUSTOM_ROLE_UPDATED',
          product: existing.productId,
          details: `Role "${existing.name}" updated.`,
        },
      })

      return updated
    } catch (e: any) {
      const idx = this.inMemoryCustomRoles.findIndex((r) => r.id === id)
      if (idx !== -1) {
        this.inMemoryCustomRoles[idx] = { ...this.inMemoryCustomRoles[idx], ...updates }
        return this.inMemoryCustomRoles[idx]
      }
      throw new NotFoundException('Role not found')
    }
  }

  async deleteCustomRole(id: string, currentUser?: AuthenticatedUser) {
    try {
      const existing = await this.prisma.role.findUnique({ where: { id } })
      if (!existing) throw new NotFoundException('Role not found')
      if (existing.isSystem) throw new BadRequestException('System template roles cannot be deleted.')

      await this.prisma.role.delete({ where: { id } })
      return { success: true }
    } catch (e) {
      this.inMemoryCustomRoles = this.inMemoryCustomRoles.filter((r) => r.id !== id)
      return { success: true }
    }
  }

  // Helper to validate product entitlement
  private async validateProductEntitlements(organizationId: string, productIds: string[]) {
    try {
      const entitlements = await this.prisma.productEntitlement.findMany({
        where: { organizationId },
      })
      const activeProductIds = new Set(
        entitlements
          .filter((e) => e.status === 'Active' || e.status === 'Trial')
          .map((e) => e.productId),
      )

      for (const pId of productIds) {
        if (pId && pId !== 'all' && !activeProductIds.has(pId)) {
          // If entitlement table is populated, enforce strictly
          if (activeProductIds.size > 0) {
            throw new BadRequestException(
              `Cannot assign role for product "${pId}". Product is not enabled for this organization.`,
            )
          }
        }
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e
    }
  }
}
