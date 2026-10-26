import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport, type Transporter } from 'nodemailer'

export interface MailMessage {
  to: string
  subject: string
  text: string
  html: string
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/**
 * Small SMTP sender configured only from environment variables (SMTP_HOST, SMTP_PORT, SMTP_SECURE,
 * SMTP_USER, SMTP_PASS, MAIL_FROM). Never throws: callers get `true` when the provider accepted the message,
 * `false` otherwise, so a mail outage can never undo a business decision that was already saved.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private transporter: Transporter | null | undefined

  constructor(private readonly config: ConfigService) {}

  private getTransporter(): Transporter | null {
    if (this.transporter !== undefined) return this.transporter
    const host = this.config.get<string>('SMTP_HOST')
    if (!host) {
      this.transporter = null
      return null
    }
    const port = Number(this.config.get('SMTP_PORT') ?? 587)
    const user = this.config.get<string>('SMTP_USER')
    const pass = this.config.get<string>('SMTP_PASS')
    this.transporter = createTransport({
      host,
      port,
      secure: String(this.config.get('SMTP_SECURE') ?? port === 465) === 'true',
      ...(user && pass ? { auth: { user, pass } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
    return this.transporter
  }

  async send(message: MailMessage): Promise<boolean> {
    const transporter = this.getTransporter()
    const from = this.config.get<string>('MAIL_FROM')
    if (!transporter || !from) {
      this.logger.warn(`Email not sent to ${message.to}: SMTP_HOST and MAIL_FROM are not configured.`)
      return false
    }
    try {
      await transporter.sendMail({ from, ...message })
      return true
    } catch (e) {
      // Log the reason, never the message body or credentials.
      this.logger.error(`Email to ${message.to} failed: ${(e as Error).message}`)
      return false
    }
  }
}
