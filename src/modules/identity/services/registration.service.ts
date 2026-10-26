import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PersonaType } from '../../../generated/prisma-client';
import { RoleRepository } from '../repositories/role.repository';
import { RegistrationRepository } from '../repositories/registration.repository';
import { PasswordService } from './password.service';
import { AuthService, RequestMeta } from './auth.service';
import { NotificationService } from './notification.service';
import { RegisterDto } from '../dto/register.dto';

@Injectable()
export class RegistrationService {
  constructor(
    private readonly roles: RoleRepository,
    private readonly registration: RegistrationRepository,
    private readonly passwordService: PasswordService,
    private readonly authService: AuthService,
    private readonly notification: NotificationService,
    private readonly config: ConfigService,
  ) {}

  async getRegistrationOptions() {
    const rows = await this.roles.findRegistrationOptions();
    // Exclude pure ADMIN_ONLY from public selector (privileged PRD leadership / admin-assigned roles)
    return rows
      .filter((r) => r.registrationMode !== 'ADMIN_ONLY')
      .map((r) => ({
        code: r.code,
        displayName: r.displayName,
        description: r.description,
        registrationMode: r.registrationMode,
        invitationRequired: r.invitationRequired,
        selfRegistrationAllowed: r.selfRegistrationAllowed,
      }));
  }

  async register(dto: RegisterDto, meta: RequestMeta = {}) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_MISMATCH',
        message: 'Password and confirmation do not match.',
      });
    }
    this.passwordService.assertPolicy(dto.password);

    const email = dto.email.trim().toLowerCase();
    const roleCode = dto.registrationRoleCode.trim().toUpperCase();

    const tenant = await this.registration.findTenantByCode(
      dto.tenantCode.trim(),
    );
    if (!tenant || ['SUSPENDED', 'EXPIRED', 'ARCHIVED'].includes(tenant.status)) {
      throw new ForbiddenException({
        code: 'AUTH_TENANT_INVALID',
        message: 'This institution is not available for registration.',
      });
    }

    const role = await this.roles.findActiveByCode(roleCode);
    if (!role) {
      throw new BadRequestException({
        code: 'AUTH_ROLE_INVALID',
        message: 'The selected registration type is not available.',
      });
    }

    if (role.registrationMode === 'ADMIN_ONLY' || !role.isActive) {
      throw new ForbiddenException({
        code: 'AUTH_ROLE_NOT_SELF_REGISTERABLE',
        message: 'This role cannot be requested through public registration.',
      });
    }

    const existing = await this.registration.findUserByEmailTenant(
      email,
      tenant.id,
    );
    if (existing) {
      // Avoid strict enumeration of status details
      throw new ConflictException({
        code: 'AUTH_EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists for this institution.',
      });
    }

    // Privileged / invitation-required: request only — no user role grant
    if (!role.selfRegistrationAllowed || role.invitationRequired) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);
      await this.registration.createRegistrationRequest({
        tenantId: tenant.id,
        email,
        requestedRoleId: role.id,
        expiresAt,
      });
      await this.notification.sendAuthNotification({
        type: 'security_alert',
        to: email,
        tenantId: tenant.id,
        meta: {
          purpose: 'registration_request_pending',
          roleCode: role.code,
        },
      });
      return {
        status: 'PENDING_APPROVAL' as const,
        message:
          'Your registration request has been submitted and is pending administrator approval.',
      };
    }

    // Self-registration (STUDENT / PARENT)
    const passwordHash = await this.passwordService.hash(dto.password);
    const persona = this.mapPersona(role.defaultPersonaType);

    const user = await this.registration.createSelfRegisteredUser({
      tenantId: tenant.id,
      email,
      passwordHash,
      personaType: persona,
      roleId: role.id,
    });

    // Issue activation token (reuses existing activation infrastructure)
    await this.authService.createActivationTokenForUser(
      user.id,
      user.tenantId,
      meta,
    );

    return {
      status: 'PENDING_ACTIVATION' as const,
      message:
        'Registration successful. Please check your email to activate your account.',
    };
  }

  private mapPersona(defaultPersona?: string | null): PersonaType {
    switch (defaultPersona) {
      case 'STUDENT':
        return 'STUDENT';
      case 'PARENT':
        return 'PARENT';
      case 'EXTERNAL':
        return 'EXTERNAL';
      default:
        return 'STAFF';
    }
  }
}
