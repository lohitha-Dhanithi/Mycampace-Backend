import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: unknown) => {
              const map: Record<string, unknown> = {
                BCRYPT_ROUNDS: 4, // fast for tests
                PASSWORD_MIN_LENGTH: 12,
                PASSWORD_REQUIRE_UPPERCASE: 'true',
                PASSWORD_REQUIRE_LOWERCASE: 'true',
                PASSWORD_REQUIRE_NUMBER: 'true',
                PASSWORD_REQUIRE_SPECIAL: 'true',
              };
              return key in map ? map[key] : def;
            },
          },
        },
      ],
    }).compile();

    service = module.get(PasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('hashes a password', async () => {
    const hash = await service.hash('ValidPass1!');
    expect(hash).toBeDefined();
    expect(hash).not.toEqual('ValidPass1!');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('compares successfully for correct password', async () => {
    const hash = await service.hash('ValidPass1!');
    await expect(service.compare('ValidPass1!', hash)).resolves.toBe(true);
  });

  it('compares failure for wrong password', async () => {
    const hash = await service.hash('ValidPass1!');
    await expect(service.compare('WrongPass1!', hash)).resolves.toBe(false);
  });

  it('accepts a strong password under policy', () => {
    const result = service.validatePolicy('StrongPass1!');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a weak password under policy', () => {
    const result = service.validatePolicy('weak');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('assertPolicy throws on weak password', () => {
    expect(() => service.assertPolicy('short')).toThrow(BadRequestException);
  });
});
