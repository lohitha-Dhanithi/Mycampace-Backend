/**
 * Platform IdentityModule (STRANGLER / DEPRECATED public API).
 * Public /auth /mfa /sso /rbac routes are owned by apps/services/identity-service.
 * This module retains JWT + authorization guards for residual platform modules only.
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { NotificationService } from './services/notification.service';
import { AuthService } from './services/auth.service';
import { MfaService } from './services/mfa.service';
import { MfaCryptoService } from './services/mfa-crypto.service';
import { SsoService } from './services/sso.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthController } from './controllers/auth.controller';
import { MfaController } from './controllers/mfa.controller';
import { SsoController } from './controllers/sso.controller';
import { PasswordResetRepository } from './repositories/password-reset.repository';
import { AuthRepository } from './repositories/auth.repository';
import { ActivationRepository } from './repositories/activation.repository';
import { MfaRepository } from './repositories/mfa.repository';
import { ExternalIdentityRepository } from './repositories/external-identity.repository';
import { GoogleOidcProvider } from './sso/providers/google-oidc.provider';
import { MicrosoftOidcProvider } from './sso/providers/microsoft-oidc.provider';
import { SamlProvider } from './sso/providers/saml.provider';
import { RegistrationService } from './services/registration.service';
import { RoleRepository } from './repositories/role.repository';
import { RegistrationRepository } from './repositories/registration.repository';
import { AuthorizationRepository } from './repositories/authorization.repository';
import { AuthorizationService } from './services/authorization.service';
import { AuthorizationGuard } from './guards/authorization.guard';
import { RbacController } from './controllers/rbac.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(
          'JWT_ACCESS_SECRET',
          'change-me-access-secret-min-32-chars-long!!',
        ),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
        },
      }),
    }),
  ],
  // DEPRECATED (2026-08-22): public Identity HTTP APIs served by identity-service :4001 via gateway.
  // Controllers removed from platform so apps/api is NOT a competing auth authority.
  // JwtAuthGuard / AuthorizationGuard remain for other platform modules until those migrate.
  controllers: [],
  providers: [
    PasswordService,
    TokenService,
    NotificationService,
    AuthService,
    MfaService,
    MfaCryptoService,
    SsoService,
    JwtStrategy,
    JwtAuthGuard,
    PasswordResetRepository,
    AuthRepository,
    ActivationRepository,
    MfaRepository,
    ExternalIdentityRepository,
    GoogleOidcProvider,
    MicrosoftOidcProvider,
    SamlProvider,
    RegistrationService,
    RoleRepository,
    RegistrationRepository,
    AuthorizationRepository,
    AuthorizationService,
    AuthorizationGuard,
  ],
  exports: [
    PasswordService,
    TokenService,
    NotificationService,
    AuthService,
    MfaService,
    SsoService,
    RegistrationService,
    AuthorizationService,
    AuthorizationGuard,
    JwtModule,
    PassportModule,
    JwtAuthGuard,
  ],
})
export class IdentityModule {}
