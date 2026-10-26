import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PrismaService } from '@/prisma/prisma.service'
import { IS_PUBLIC_KEY } from './public.decorator'
import { ALLOW_UNVERIFIED_KEY } from './allow-unverified.decorator'

/**
 * Enforces the rule "no normal ERP access until the institution application is APPROVED".
 * Runs on every request after JWT validation, so a valid token alone is never enough.
 * SuperAdmins (platform staff) are exempt.
 */
@Injectable()
export class ApprovalGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()]
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, targets)) return true

    const user = context.switchToHttp().getRequest().user as { organizationId: string; platformRole: string } | undefined
    if (!user) return true // JwtAuthGuard already rejected unauthenticated calls
    if (user.platformRole === 'SuperAdmin') return true

    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { verificationStatus: true },
    })
    if (org?.verificationStatus === 'Approved') return true

    throw new ForbiddenException({
      statusCode: 403,
      code: 'ORG_NOT_APPROVED',
      message: 'Your institution has not been approved yet. ERP access is available only after verification.',
      verificationStatus: org?.verificationStatus ?? 'Draft',
    })
  }
}
