import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '@/prisma/prisma.service'
import { accessTokenFromCookie } from './auth.cookies'
import { resolveJwtSecret } from './jwt-secret'

export interface JwtPayload {
  sub: string
  /** Refresh-token session the access token was issued with (absent on tokens issued before sessions were bound). */
  sid?: string
  orgId: string
  email: string
  platformRole: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      // Browser sessions use the HttpOnly cookie; Bearer is kept for API tools / Swagger.
      jwtFromRequest: ExtractJwt.fromExtractors([
        accessTokenFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    })
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, organizationId: true, email: true, platformRole: true, status: true },
    })
    if (!user || user.status !== 'Active') {
      throw new UnauthorizedException('Session is invalid or user is inactive.')
    }
    const activeSession = await this.prisma.refreshToken.findFirst({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...(payload.sid ? { id: payload.sid } : {}),
      },
      select: { id: true },
    })
    if (!activeSession) {
      throw new UnauthorizedException('Session is invalid or user is inactive.')
    }
    return {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      platformRole: user.platformRole,
    }
  }
}
