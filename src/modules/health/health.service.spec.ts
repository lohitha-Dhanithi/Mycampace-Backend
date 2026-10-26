import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns ok when database is up', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const result = await service.check();
    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe('up');
    expect(result.service).toBe('aichrona-api');
  });

  it('returns degraded when database is down', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const result = await service.check();
    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe('down');
  });
});
