import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { PrismaService, UserRole } from '@ticketbot/database';
import { AppModule } from '../../src/app.module';
import { AuthGuard } from '../../src/common/guards/auth.guard';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { SupabaseAdminService } from '../../src/modules/supabase/supabase-admin.service';
import { TestAuthGuard } from './test-auth.guard';
import {
  TEST_SUPABASE_ID,
  TEST_USER_EMAIL,
  TEST_USER_FULL_NAME,
  TEST_USER_ID,
  TEST_ROOT_ASSOCIATION_ID,
  TEST_NON_ADMIN_EMAIL,
  TEST_NON_ADMIN_FULL_NAME,
  TEST_NON_ADMIN_SUPABASE_ID,
  TEST_NON_ADMIN_USER_ID,
} from './test-user';

export interface E2EContext {
  app: NestFastifyApplication;
  prisma: PrismaService;
}

/**
 * In-memory Supabase admin replacement for e2e. Generates a synthetic
 * UUID per createUser call; duplicate emails are caught by the local
 * User.email @unique constraint, so this fake doesn't need to track
 * them — the saga's rollback path is exercised either way.
 */
class FakeSupabaseAdmin {
  private counter = 1000;
  getAuthClient() {
    return {
      createUser: async () => ({
        data: {
          user: {
            id: `00000000-0000-0000-0000-${String(this.counter++).padStart(
              12,
              '0',
            )}`,
          },
        },
        error: null,
      }),
      deleteUser: async () => ({ data: {}, error: null }),
    };
  }
}

export async function createTestApp(): Promise<E2EContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(AuthGuard)
    .useClass(TestAuthGuard)
    .overrideProvider(SupabaseAdminService)
    .useValue(new FakeSupabaseAdmin())
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  );

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

/**
 * Seed both test users (admin + non-admin) plus a sentinel root
 * association whose only purpose is to carry the SYSTEM_ADMIN
 * membership grant for the admin token.
 */
export async function seedTestUser(prisma: PrismaService): Promise<void> {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      fullName: TEST_USER_FULL_NAME,
      supabaseUserId: TEST_SUPABASE_ID,
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { id: TEST_NON_ADMIN_USER_ID },
    create: {
      id: TEST_NON_ADMIN_USER_ID,
      email: TEST_NON_ADMIN_EMAIL,
      fullName: TEST_NON_ADMIN_FULL_NAME,
      supabaseUserId: TEST_NON_ADMIN_SUPABASE_ID,
    },
    update: {},
  });

  await prisma.association.upsert({
    where: { id: TEST_ROOT_ASSOCIATION_ID },
    create: {
      id: TEST_ROOT_ASSOCIATION_ID,
      name: 'System Root (test)',
      taxNumber: '0000000001',
      foundedAt: new Date('2020-01-01T00:00:00.000Z'),
      address: 'System',
      city: 'System',
      district: 'System',
      phone: '+905550000000',
      email: 'system-root@test.local',
      activityArea: 'System',
      memberCount: 0,
      isActive: true,
      createdById: TEST_USER_ID,
    },
    update: {},
  });

  await prisma.associationMembership.upsert({
    where: {
      userId_associationId_role: {
        userId: TEST_USER_ID,
        associationId: TEST_ROOT_ASSOCIATION_ID,
        role: UserRole.SYSTEM_ADMIN,
      },
    },
    create: {
      userId: TEST_USER_ID,
      associationId: TEST_ROOT_ASSOCIATION_ID,
      role: UserRole.SYSTEM_ADMIN,
      isActive: true,
    },
    update: { isActive: true },
  });
}

/**
 * Wipe everything the e2e suite created, but keep the seeded users +
 * sentinel root association + SYSTEM_ADMIN membership so the next test
 * still authenticates without re-seeding.
 */
export async function truncateAssociations(prisma: PrismaService): Promise<void> {
  await prisma.associationMembership.deleteMany({
    where: { associationId: { not: TEST_ROOT_ASSOCIATION_ID } },
  });
  await prisma.association.deleteMany({
    where: { id: { not: TEST_ROOT_ASSOCIATION_ID } },
  });
  await prisma.user.deleteMany({
    where: { id: { notIn: [TEST_USER_ID, TEST_NON_ADMIN_USER_ID] } },
  });
}
