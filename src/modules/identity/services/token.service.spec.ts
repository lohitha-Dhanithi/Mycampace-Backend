import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-access-secret-min-32-characters!!',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [
        TokenService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: unknown) => {
              const map: Record<string, unknown> = {
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '30d',
              };
              return key in map ? map[key] : def;
            },
          },
        },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates an access JWT with required claims', () => {
    const { accessToken, expiresIn } = service.createAccessToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@example.com',
      personaType: 'STAFF',
    });
    expect(accessToken).toBeDefined();
    expect(typeof accessToken).toBe('string');
    expect(expiresIn).toBe('15m');

    const payload = service.verifyAccessToken(accessToken);
    expect(payload.sub).toBe('user-1');
    expect(payload.tenantId).toBe('tenant-1');
    expect(payload.email).toBe('a@example.com');
    expect(payload.personaType).toBe('STAFF');
  });

  it('generates opaque refresh tokens that are random', () => {
    const a = service.generateRefreshToken();
    const b = service.generateRefreshToken();
    expect(a.rawToken).not.toEqual(b.rawToken);
    expect(a.tokenHash).not.toEqual(b.tokenHash);
    expect(a.rawToken.length).toBeGreaterThan(32);
  });

  it('hashes refresh tokens and compares correctly', () => {
    const { rawToken, tokenHash } = service.generateRefreshToken();
    expect(service.hashRefreshToken(rawToken)).toBe(tokenHash);
    expect(service.compareRefreshToken(rawToken, tokenHash)).toBe(true);
    expect(service.compareRefreshToken('wrong-token', tokenHash)).toBe(false);
  });

  it('preserves familyId when provided', () => {
    const familyId = 'family-abc';
    const result = service.generateRefreshToken(familyId);
    expect(result.familyId).toBe(familyId);
  });

  it('generates one-time tokens', () => {
    const { rawToken, tokenHash } = service.generateOneTimeToken();
    expect(rawToken).toBeDefined();
    expect(tokenHash).toBe(service.hashOneTimeToken(rawToken));
  });
});
