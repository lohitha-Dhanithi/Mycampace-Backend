// backend/src/app.module.ts
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { MailModule } from './common/mail/mail.module'
import { RedisCacheModule } from './cache/redis-cache.module'
import { JwtAuthGuard } from './common/auth/jwt-auth.guard'
import { RbacGuard } from './common/auth/rbac.guard'
import { ApprovalGuard } from './common/auth/approval.guard'

import { AuthModule } from './modules/auth/auth.module'
import { OrganizationModule } from './modules/organization/organization.module'
import { ProductsModule } from './modules/products/products.module'
import { UsersModule } from './modules/users/users.module'
import { AcademicsModule } from './modules/academics/academics.module'
import { LmsModule } from './modules/lms/lms.module'
import { FinanceModule } from './modules/finance/finance.module'
import { AdmissionsModule } from './modules/admissions/admissions.module'
import { OnboardingModule } from './modules/onboarding/onboarding.module'
import { CatalogModule } from './modules/catalog/catalog.module'
import { VerificationModule } from './modules/verification/verification.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    MailModule,
    RedisCacheModule,
    CatalogModule,
    AuthModule,
    OnboardingModule,
    VerificationModule,
    OrganizationModule,
    ProductsModule,
    UsersModule,
    AcademicsModule,
    LmsModule,
    FinanceModule,
    AdmissionsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
    {
      // Blocks ERP routes until the institution application is APPROVED (see @AllowUnverified)
      provide: APP_GUARD,
      useClass: ApprovalGuard,
    },
  ],
})
export class AppModule {}
