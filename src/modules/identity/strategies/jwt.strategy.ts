import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { AuthContext } from '../interfaces/auth-context.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET', 'change-me-access-secret-min-32-chars-long!!'),
    });
  }

  /**
   * Called after JWT signature + expiry are verified by passport-jwt.
   * Performs live DB checks so revoked/disabled users cannot use a still-valid JWT.
   */
  async validate(payload: JwtPayload): Promise<AuthContext> {
    if (!payload?.sub || !payload?.tenantId || !payload?.email || !payload?.personaType) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Invalid access token.',
      });
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        personaType: true,
        status: true,
        tenant: {
          select: { status: true, deletedAt: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Invalid access token.',
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'AUTH_ACCOUNT_INACTIVE',
        message: 'This account is not active.',
      });
    }

    if (
      !user.tenant ||
      user.tenant.deletedAt ||
      user.tenant.status === 'SUSPENDED' ||
      user.tenant.status === 'EXPIRED' ||
      user.tenant.status === 'ARCHIVED'
    ) {
      throw new UnauthorizedException({
        code: 'AUTH_TENANT_SUSPENDED',
        message: "This institution's access is currently suspended.",
      });
    }

    // Tenant always comes from verified identity, never from client input
    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      personaType: user.personaType,
    };
  }
}
