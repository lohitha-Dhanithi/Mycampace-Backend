import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class PasswordService {
  private readonly rounds: number;
  private readonly minLength: number;
  private readonly requireUppercase: boolean;
  private readonly requireLowercase: boolean;
  private readonly requireNumber: boolean;
  private readonly requireSpecial: boolean;

  constructor(private readonly config: ConfigService) {
    this.rounds = this.config.get<number>('BCRYPT_ROUNDS', 12);
    this.minLength = this.config.get<number>('PASSWORD_MIN_LENGTH', 12);
    this.requireUppercase = this.config.get<string>('PASSWORD_REQUIRE_UPPERCASE', 'true') === 'true';
    this.requireLowercase = this.config.get<string>('PASSWORD_REQUIRE_LOWERCASE', 'true') === 'true';
    this.requireNumber = this.config.get<string>('PASSWORD_REQUIRE_NUMBER', 'true') === 'true';
    this.requireSpecial = this.config.get<string>('PASSWORD_REQUIRE_SPECIAL', 'true') === 'true';
  }

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  validatePolicy(plain: string): PasswordPolicyResult {
    const errors: string[] = [];

    if (!plain || plain.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters.`);
    }
    if (this.requireUppercase && !/[A-Z]/.test(plain)) {
      errors.push('Password must contain at least one uppercase letter.');
    }
    if (this.requireLowercase && !/[a-z]/.test(plain)) {
      errors.push('Password must contain at least one lowercase letter.');
    }
    if (this.requireNumber && !/[0-9]/.test(plain)) {
      errors.push('Password must contain at least one number.');
    }
    if (this.requireSpecial && !/[^A-Za-z0-9]/.test(plain)) {
      errors.push('Password must contain at least one special character.');
    }

    return { valid: errors.length === 0, errors };
  }

  /** Throws BadRequestException if policy fails. */
  assertPolicy(plain: string): void {
    const result = this.validatePolicy(plain);
    if (!result.valid) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_POLICY_VIOLATION',
        message: result.errors.join(' '),
        errors: result.errors,
      });
    }
  }
}
