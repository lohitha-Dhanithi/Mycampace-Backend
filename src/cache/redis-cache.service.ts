// backend/src/cache/redis-cache.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null
  private readonly logger = new Logger(RedisCacheService.name)
  private isConnected = false
  private disabled = false

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.get<string>('REDIS_DISABLED') === 'true') {
      this.disabled = true
      this.logger.log('Redis cache disabled (REDIS_DISABLED=true)')
      return
    }

    const host = this.config.get<string>('REDIS_HOST', 'localhost')
    const port = this.config.get<number>('REDIS_PORT', 6379)
    const password = this.config.get<string>('REDIS_PASSWORD', '')

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    })

    this.client.on('error', () => {
      // Avoid noisy unhandled error events when Redis is not running locally.
    })

    this.client
      .connect()
      .then(() => {
        this.isConnected = true
        this.logger.log(`Redis connected on ${host}:${port}`)
      })
      .catch(() => {
        this.disabled = true
        this.logger.warn('Redis unavailable — continuing without cache.')
        this.client?.disconnect()
        this.client = null
      })
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.disabled || !this.isConnected || !this.client) return null
    try {
      const data = await this.client.get(key)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }

  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    if (this.disabled || !this.isConnected || !this.client) return
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch {
      // ignore
    }
  }

  async del(key: string): Promise<void> {
    if (this.disabled || !this.isConnected || !this.client) return
    try {
      await this.client.del(key)
    } catch {
      // ignore
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect()
    }
  }
}
