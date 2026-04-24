import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaService } from '@ticketbot/database';
import request from 'supertest';
import {
  createTestApp,
  seedTestUser,
  truncateAssociations,
} from './utils/test-app.factory';
import {
  TEST_BEARER_TOKEN,
  TEST_NON_ADMIN_BEARER_TOKEN,
  TEST_USER_ID,
  TEST_USER_EMAIL,
  TEST_USER_FULL_NAME,
  TEST_NON_ADMIN_USER_ID,
  TEST_NON_ADMIN_EMAIL,
  TEST_NON_ADMIN_FULL_NAME,
} from './utils/test-user';

const URL = '/api/v1/auth/me';

describe('GET /auth/me (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    await seedTestUser(prisma);
  });

  afterAll(async () => {
    await truncateAssociations(prisma);
    await app.close();
  });

  it('returns 401 when unauthenticated', async () => {
    await request(app.getHttpServer()).get(URL).expect(401);
  });

  it('returns the authenticated user with SYSTEM_ADMIN role for admin token', async () => {
    const res = await request(app.getHttpServer())
      .get(URL)
      .set('Authorization', `Bearer ${TEST_BEARER_TOKEN}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      fullName: TEST_USER_FULL_NAME,
      systemRole: 'SYSTEM_ADMIN',
    });
    expect(Array.isArray(res.body.memberships)).toBe(true);
    expect(res.body.memberships.length).toBeGreaterThan(0);
  });

  it('returns null systemRole for non-admin token', async () => {
    const res = await request(app.getHttpServer())
      .get(URL)
      .set('Authorization', `Bearer ${TEST_NON_ADMIN_BEARER_TOKEN}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: TEST_NON_ADMIN_USER_ID,
      email: TEST_NON_ADMIN_EMAIL,
      fullName: TEST_NON_ADMIN_FULL_NAME,
      systemRole: null,
    });
    expect(Array.isArray(res.body.memberships)).toBe(true);
  });
});
