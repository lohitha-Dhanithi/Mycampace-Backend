import { Injectable, Logger } from '@nestjs/common';
import { AuditRepository } from '../repositories/audit.repository';

export interface AuditEventInput {
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  result?: 'SUCCESS' | 'FAILURE' | 'DENIED';
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEY =
  /password|token|secret|otp|hash|authorization|cookie|refresh|mfa|totp/i;

/**
 * Append-only audit writer. Never stores credentials or raw tokens.
 * Future: edu.sp_audit_log_create | edu.sp_audit_log_list — PLANNED
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  async log(event: AuditEventInput): Promise<void> {
    try {
      const metadata = this.sanitize(event.metadata);
      await this.repo.create({
        action: event.action.slice(0, 100),
        module: event.module.slice(0, 50),
        entityType: event.entityType?.slice(0, 80) ?? null,
        entityId: event.entityId?.slice(0, 80) ?? null,
        result: event.result ?? 'SUCCESS',
        correlationId: event.correlationId?.slice(0, 80) ?? null,
        ipAddress: event.ipAddress?.slice(0, 64) ?? null,
        userAgent: event.userAgent?.slice(0, 500) ?? null,
        metadata: metadata as object | undefined,
        actorUserId: event.actorUserId ?? null,
        ...(event.tenantId
          ? { tenant: { connect: { id: event.tenantId } } }
          : {}),
      });
    } catch (err) {
      this.logger.warn(
        `audit_write_failed action=${event.action} err=${String(err)}`,
      );
    }
  }

  private sanitize(
    meta?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!meta) return undefined;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (SENSITIVE_KEY.test(k)) continue;
      if (typeof v === 'string' && v.length > 500) {
        out[k] = `${v.slice(0, 500)}…`;
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}
