import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';
import {
  EVENT_REMINDERS_QUEUE,
  TASK_REMINDERS_QUEUE,
} from './jobs.constants';

export type WorkHandler<T> = (job: PgBoss.Job<T>) => Promise<void>;

@Injectable()
export class PgBossService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PgBossService.name);
  private boss: PgBoss | null = null;
  private startupPromise: Promise<void> | null = null;
  // Serialise `boss.work()` registrations to dodge the same metadata
  // deadlock class that bit `boss.createQueue()` when called in parallel.
  // Boot is one-time so this costs ~milliseconds total.
  private workChain: Promise<void> = Promise.resolve();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureStarted();
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.boss) return;
    try {
      await this.boss.stop({ graceful: true, wait: true });
    } catch (err) {
      this.logger.warn(`pg-boss stop failed: ${(err as Error).message}`);
    } finally {
      this.boss = null;
      this.startupPromise = null;
    }
  }

  async ensureStarted(): Promise<void> {
    if (this.boss) return;
    if (this.startupPromise) {
      await this.startupPromise;
      return;
    }
    // If start() rejects (Postgres unavailable at boot, etc.), clear the
    // memoised promise so the next caller retries instead of permanently
    // replaying the stale error.
    this.startupPromise = this.start().catch((err) => {
      this.startupPromise = null;
      throw err;
    });
    await this.startupPromise;
  }

  async send<T extends object>(
    queue: string,
    data: T,
    options: PgBoss.SendOptions,
  ): Promise<string | null> {
    const boss = await this.getBoss();
    return boss.send(queue, data, options);
  }

  async cancel(queue: string, id: string): Promise<void> {
    const boss = await this.getBoss();
    try {
      await boss.cancel(queue, id);
    } catch (err) {
      // pg-boss throws if the job is already completed or cancelled.
      // Callers don't need to special-case that.
      this.logger.debug(
        `cancel(${queue}, ${id}) ignored: ${(err as Error).message}`,
      );
    }
  }

  async work<T extends object>(
    queue: string,
    handler: WorkHandler<T>,
  ): Promise<void> {
    const boss = await this.getBoss();
    const next = this.workChain.then(() =>
      boss.work<T>(queue, async (jobs) => {
        for (const job of jobs) {
          await handler(job);
        }
      }),
    );
    // Keep the chain alive even if this registration throws, so a later
    // work() call still serialises behind the previous one.
    this.workChain = next.then(
      () => undefined,
      () => undefined,
    );
    await next;
  }

  private async getBoss(): Promise<PgBoss> {
    await this.ensureStarted();
    if (!this.boss) {
      throw new Error('pg-boss failed to initialise');
    }
    return this.boss;
  }

  private async start(): Promise<void> {
    // pg-boss uses advisory locks + LISTEN/NOTIFY, both of which break
    // through PgBouncer transaction-mode pooling. Prefer DIRECT_URL when
    // set (Supabase direct connection on :5432); fall back to DATABASE_URL
    // for local dev where there's only one URL.
    const connectionString =
      this.config.get<string>('database.directUrl') ??
      this.config.get<string>('database.url');

    if (!connectionString) {
      throw new Error('pg-boss: neither DIRECT_URL nor DATABASE_URL is set');
    }

    const boss = new PgBoss({
      connectionString,
      schema: 'pgboss',
      // Default poll interval is ~2s; 5s is plenty for reminder jobs and
      // ~2.5× less Postgres load.
      pollingIntervalSeconds: 5,
    });

    boss.on('error', (err) =>
      this.logger.error(`pg-boss error: ${err.message}`, err.stack),
    );

    await boss.start();

    // pg-boss v10 requires queues to be created explicitly. Idempotent.
    // Serialize: parallel createQueue calls deadlock on pgboss metadata
    // (concurrent ALTER TABLE on pgboss.queue → ShareRowExclusiveLock cycle).
    await boss.createQueue(TASK_REMINDERS_QUEUE);
    await boss.createQueue(EVENT_REMINDERS_QUEUE);

    this.boss = boss;
    this.logger.log('pg-boss started; queues ready');
  }
}
