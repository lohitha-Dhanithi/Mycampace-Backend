import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../../prisma/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: {
    user: { findFirst: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn() },
    };
    const config = {
      get: (key: string, def?: string) =>
        key === 'JWT_ACCESS_SECRET' ? 'test-secret-min-32-characters-long!!' : def,
    } as ConfigService;

    strategy = new JwtStrategy(config, prisma as unknown as PrismaService);
  });

  it('returns AuthContext for a valid active user and tenant', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      email: 'a@example.com',
      personaType: 'STAFF',
      status: 'ACTIVE',
      tenant: { status: 'ACTIVE', deletedAt: null },
    });

    const ctx = await strategy.validate({
      sub: 'u1',
      tenantId: 't1',
      email: 'a@example.com',
      personaType: 'STAFF',
    });

    expect(ctx).toEqual({
      userId: 'u1',
      tenantId: 't1',
      email: 'a@example.com',
      personaType: 'STAFF',
    });
  });

  it('rejects missing required claims', async () => {
    await expect(
      strategy.validate({ sub: '', tenantId: '', email: '', personaType: '' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects nonexistent user', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      strategy.validate({
        sub: 'missing',
        tenantId: 't1',
        email: 'x@example.com',
        personaType: 'STAFF',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects inactive user', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      email: 'a@example.com',
      personaType: 'STAFF',
      status: 'INACTIVE',
      tenant: { status: 'ACTIVE', deletedAt: null },
    });
    await expect(
      strategy.validate({
        sub: 'u1',
        tenantId: 't1',
        email: 'a@example.com',
        personaType: 'STAFF',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects suspended tenant', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      email: 'a@example.com',
      personaType: 'STAFF',
      status: 'ACTIVE',
      tenant: { status: 'SUSPENDED', deletedAt: null },
    });
    await expect(
      strategy.validate({
        sub: 'u1',
        tenantId: 't1',
        email: 'a@example.com',
        personaType: 'STAFF',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
