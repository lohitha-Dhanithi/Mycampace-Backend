// backend/src/prisma/prisma.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit() {
    try {
      await this.$connect()
      this.logger.log('Connected to PostgreSQL')
    } catch {
      this.logger.warn(
        'Database connection failed. Run: npm run db:setup (starts embedded Postgres on Windows without Docker).',
      )
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
