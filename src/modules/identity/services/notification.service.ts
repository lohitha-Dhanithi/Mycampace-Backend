import { Injectable, Logger } from '@nestjs/common';

export type NotificationChannel = 'email' | 'sms' | 'in_app';

export interface AuthNotificationPayload {
  type: 'password_reset' | 'account_activation' | 'mfa_otp' | 'security_alert' | 'registration_request' | 'admission_status';
  to: string;
  tenantId?: string;
  /** Non-sensitive metadata only. Never include passwords, OTPs, or raw tokens. */
  meta?: Record<string, string | number | boolean>;
}

/**
 * Auth notification abstraction.
 * Development implementation logs a non-sensitive event.
 * A real provider (SES/SNS/etc.) can replace this later without changing callers.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /**
   * Dispatch an authentication-related notification.
   * Never pass passwords, OTP codes, or raw tokens in `meta`.
   * For local testing, the caller may log a link separately under NODE_ENV=development.
   */
  async sendAuthNotification(payload: AuthNotificationPayload): Promise<void> {
    // Strip anything that looks sensitive from meta before logging
    const safeMeta = { ...(payload.meta ?? {}) };
    for (const key of Object.keys(safeMeta)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('password') ||
        lower.includes('otp') ||
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('code')
      ) {
        delete safeMeta[key];
      }
    }

    this.logger.log(
      JSON.stringify({
        event: 'auth_notification',
        type: payload.type,
        to: this.maskRecipient(payload.to),
        tenantId: payload.tenantId,
        meta: safeMeta,
      }),
    );
  }

  /**
   * Generic business notification (admissions, etc.).
   * Same safety rules as auth notifications.
   * Future providers: SES/SNS — edu.sp_notification_create PLANNED
   */
  async sendBusinessNotification(payload: {
    type: string;
    channel?: NotificationChannel;
    to: string;
    tenantId?: string;
    meta?: Record<string, string | number | boolean>;
  }): Promise<{ delivered: boolean; mode: 'log' | 'provider' }> {
    await this.sendAuthNotification({
      type: (payload.type as AuthNotificationPayload['type']) || 'security_alert',
      to: payload.to,
      tenantId: payload.tenantId,
      meta: payload.meta,
    });
    // No external provider configured in foundation — log-only
    return { delivered: false, mode: 'log' };
  }

  private maskRecipient(to: string): string {
    if (to.includes('@')) {
      const [local, domain] = to.split('@');
      const maskedLocal =
        local.length <= 2 ? '*'.repeat(local.length) : `${local[0]}***${local[local.length - 1]}`;
      return `${maskedLocal}@${domain}`;
    }
    // phone-like
    if (to.length > 4) {
      return `***${to.slice(-4)}`;
    }
    return '***';
  }
}
