import { PgBossService } from './pgboss.service';

describe('PgBossService environment isolation', () => {
  const config = {
    get: jest.fn((key: string) => (key === 'jobs.enabled' ? false : undefined)),
  };

  beforeEach(() => jest.clearAllMocks());

  it('does not start when jobs are disabled', async () => {
    const service = new PgBossService(config as never);

    await expect(service.ensureStarted()).resolves.toBeUndefined();
  });

  it('returns no job id when jobs are disabled', async () => {
    const service = new PgBossService(config as never);

    await expect(service.send('queue', { id: '1' }, {})).resolves.toBeNull();
  });

  it('does not register workers when jobs are disabled', async () => {
    const service = new PgBossService(config as never);
    const handler = jest.fn();

    await expect(service.work('queue', handler)).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });
});
