// backend/src/main.ts
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import * as cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { csrfHeaderGuard, CSRF_HEADER } from './modules/auth/auth.cookies'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Session cookies (HttpOnly access/refresh tokens) + CSRF header check for cookie auth
  app.use(cookieParser())
  app.use(csrfHeaderGuard)

  // Global API Prefix
  app.setGlobalPrefix('api')

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  // CORS Configuration
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
      ]

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER],
  })

  // OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('MyCampace Platform API')
    .setDescription(
      'Multi-Product Education SaaS Platform REST API with PostgreSQL, Prisma ORM, Redis Cache, and Product-Specific RBAC.',
    )
    .setVersion('1.0.0')
    .addTag('Identity & Auth', 'Single identity authentication, Google SSO, and session management')
    .addTag('Organization', 'Tenant organization profile, campuses, and global academic context')
    .addTag('Products & Entitlements', 'Product catalog, subscriptions, and activation')
    .addTag('Users & RBAC', 'User directory and product-specific role assignments')
    .addTag('Academics', 'Academic structure, programs, courses, and schedules')
    .addTag('LMS', 'Digital learning, course modules, assignments, and quizzes')
    .addTag('Finance', 'Fee structures, invoices, payments, and DhanitiPay services')
    .addTag('Admissions', 'CRM, leads pipeline, and application management')
    .addTag('Onboarding', 'Organization setup wizard and workspace activation')
    .addBearerAuth()
    .addCookieAuth('mc_at', { type: 'apiKey', in: 'cookie', name: 'mc_at' }, 'mc_at')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'MyCampace OpenAPI Docs',
  })

  const port = process.env.PORT || 4000
  await app.listen(port)
  console.log(`🚀 MyCampace Backend running on: http://localhost:${port}/api`)
  console.log(`📖 OpenAPI Swagger docs ready at: http://localhost:${port}/api/docs`)
}
bootstrap()
