import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CronJob } from 'cron';
import { PrismaService } from '@ticketbot/database';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PENDING_THRESHOLD_DAYS = 7;

/**
 * Periodically removes users who were invited (via Supabase invite) but never
 * activated their account. Prevents orphaned Supabase auth identities and
 * half-created associations from cluttering the system.
 */
@Injectable()
export class PendingUserCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PendingUserCleanupService.name);
  private job: CronJob | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseAdminService,
  ) {}

  onModuleInit() {
    // Run once on startup, then every 24 hours at 03:00 server time.
    this.logger.log('Pending user cleanup service initialized');
    this.job = new CronJob('0 3 * * *', () => this.executeCleanup());
    this.job.start();

    // Also run once after a short delay on startup to catch any stale records.
    setTimeout(() => this.executeCleanup(), 30_000);
  }

  onModuleDestroy() {
    this.job?.stop();
  }

  async executeCleanup(): Promise<void> {
    this.logger.log('Running pending user cleanup...');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PENDING_THRESHOLD_DAYS);

    const pendingUsers = await this.prisma.user.findMany({
      where: {
        activatedAt: null,
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
        fullName: true,
        createdAt: true,
      },
    });

    if (pendingUsers.length === 0) {
      this.logger.log('No pending users to clean up');
      return;
    }

    this.logger.log(`Found ${pendingUsers.length} pending users to clean up`);

    let cleaned = 0;
    let failed = 0;

    for (const user of pendingUsers) {
      try {
        // Delete Supabase user first
        if (user.supabaseUserId) {
          try {
            await this.supabase.getAuthClient().deleteUser(user.supabaseUserId);
          } catch (supabaseErr) {
            this.logger.warn(
              `Supabase delete failed for ${user.email}: ${(supabaseErr as Error).message}`,
            );
          }
        }

        // Delete from DB (cascade will remove memberships, associations, etc.)
        await this.prisma.user.delete({ where: { id: user.id } });

        cleaned++;
        this.logger.log(
          `Cleaned up pending user: ${user.email} (${user.fullName}) — created ${user.createdAt.toISOString()}`,
        );
      } catch (err) {
        failed++;
        this.logger.error(
          `Failed to clean up user ${user.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Cleanup complete: ${cleaned} removed, ${failed} failed out of ${pendingUsers.length} pending users`,
    );
  }
}
