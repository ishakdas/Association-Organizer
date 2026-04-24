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
} from './utils/test-user';

const BASE = '/api/v1/associations';

const buildValidAssociation = (overrides: Record<string, unknown> = {}) => ({
  name: 'TEST Derneği',
  shortName: 'TD',
  taxNumber: '1234567890',
  foundedAt: '2020-01-01T00:00:00.000Z',
  address: 'Test Mah. No:1',
  city: 'Ankara',
  district: 'Çankaya',
  phone: '+905551112233',
  email: 'e2e@dernek.org',
  activityArea: 'Eğitim',
  memberCount: 10,
  isActive: true,
  manager: {
    fullName: 'E2E Başkan',
    email: 'e2e-baskan@dernek.local',
    password: 'super-strong-pass',
    phone: '+905554445566',
  },
  ...overrides,
});

describe('Associations (e2e)', () => {
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

  beforeEach(async () => {
    await truncateAssociations(prisma);
  });

  const auth = (req: request.Test, token = TEST_BEARER_TOKEN) =>
    req.set('Authorization', `Bearer ${token}`);

  describe('POST /associations', () => {
    it('1) returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .post(BASE)
        .send(buildValidAssociation())
        .expect(401);
    });

    it('2) returns 400 when body is invalid (VKN 9 digits)', async () => {
      const res = await auth(
        request(app.getHttpServer())
          .post(BASE)
          .send(buildValidAssociation({ taxNumber: '123456789' })),
      );
      expect(res.status).toBe(400);
    });

    it('3) returns 400 when manager.password is shorter than 8 chars', async () => {
      const res = await auth(
        request(app.getHttpServer())
          .post(BASE)
          .send(
            buildValidAssociation({
              manager: {
                fullName: 'X Y',
                email: 'weakpw@dernek.local',
                password: 'short',
              },
            }),
          ),
      );
      expect(res.status).toBe(400);
    });

    it('4) returns 403 when caller is not SYSTEM_ADMIN', async () => {
      const res = await auth(
        request(app.getHttpServer())
          .post(BASE)
          .send(buildValidAssociation()),
        TEST_NON_ADMIN_BEARER_TOKEN,
      );
      expect(res.status).toBe(403);
    });

    it('5) returns 201 and persists 3 rows (manager user + association + manager membership)', async () => {
      const res = await auth(
        request(app.getHttpServer())
          .post(BASE)
          .send(buildValidAssociation()),
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'TEST Derneği',
        taxNumber: '1234567890',
        createdById: TEST_USER_ID,
      });

      const association = await prisma.association.findUnique({
        where: { id: res.body.id },
        include: {
          memberships: {
            where: { role: 'ASSOCIATION_MANAGER' },
            include: { user: true },
          },
        },
      });
      expect(association).not.toBeNull();
      expect(association!.memberships).toHaveLength(1);

      const mgrMembership = association!.memberships[0];
      expect(mgrMembership.isActive).toBe(true);
      expect(mgrMembership.user.email).toBe('e2e-baskan@dernek.local');
      expect(mgrMembership.user.fullName).toBe('E2E Başkan');
      expect(mgrMembership.user.supabaseUserId).toMatch(
        /^00000000-0000-0000-0000-\d{12}$/,
      );
    });

    it('6) returns 409 when manager email is already registered (saga rolls back)', async () => {
      // First creation seeds the email; second creation must collide on
      // User.email @unique and trigger the Supabase rollback.
      await auth(
        request(app.getHttpServer())
          .post(BASE)
          .send(buildValidAssociation()),
      ).expect(201);

      const dupe = await auth(
        request(app.getHttpServer())
          .post(BASE)
          .send(
            buildValidAssociation({
              taxNumber: '9999999999',
              email: 'other-org@dernek.org',
              // Same manager email — must conflict.
            }),
          ),
      );
      expect(dupe.status).toBe(409);

      // Saga rollback: only the first association exists, no orphan
      // membership rows from the second attempt.
      const created = await prisma.association.findMany({
        where: { taxNumber: { in: ['1234567890', '9999999999'] } },
      });
      expect(created).toHaveLength(1);
      expect(created[0].taxNumber).toBe('1234567890');
    });

    it('7) returns 409 when taxNumber already exists (no Supabase work needed)', async () => {
      await auth(
        request(app.getHttpServer())
          .post(BASE)
          .send(buildValidAssociation()),
      ).expect(201);

      const dupe = await auth(
        request(app.getHttpServer())
          .post(BASE)
          .send(
            buildValidAssociation({
              email: 'other@dernek.org',
              manager: {
                fullName: 'Different Mgr',
                email: 'different-mgr@dernek.local',
                password: 'super-strong-pass',
              },
            }),
          ),
      );
      expect(dupe.status).toBe(409);
    });
  });

  describe('GET /associations', () => {
    it('8) admin: sees all (paginated) — at least the two we just created', async () => {
      await auth(
        request(app.getHttpServer())
          .post(BASE)
          .send(
            buildValidAssociation({
              taxNumber: '2000000001',
              email: 'a1@dernek.org',
              manager: {
                fullName: 'M1',
                email: 'm1@dernek.local',
                password: 'super-strong-pass',
              },
            }),
          ),
      ).expect(201);
      await auth(
        request(app.getHttpServer())
          .post(BASE)
          .send(
            buildValidAssociation({
              taxNumber: '2000000002',
              email: 'a2@dernek.org',
              manager: {
                fullName: 'M2',
                email: 'm2@dernek.local',
                password: 'super-strong-pass',
              },
            }),
          ),
      ).expect(201);

      const res = await auth(
        request(app.getHttpServer()).get(`${BASE}?page=1&pageSize=20`),
      );

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('9) non-admin: sees only associations they have an active membership in (none)', async () => {
      const res = await auth(
        request(app.getHttpServer()).get(BASE),
        TEST_NON_ADMIN_BEARER_TOKEN,
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });
  });

  describe('GET /associations/:id', () => {
    it('10) returns 200 when id is valid', async () => {
      const create = await auth(
        request(app.getHttpServer())
          .post(BASE)
          .send(buildValidAssociation({ taxNumber: '3000000001' })),
      );
      expect(create.status).toBe(201);

      const res = await auth(
        request(app.getHttpServer()).get(`${BASE}/${create.body.id}`),
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: create.body.id,
        taxNumber: '3000000001',
      });
    });

    it('11) returns 404 when id does not exist', async () => {
      const res = await auth(
        request(app.getHttpServer()).get(`${BASE}/ck-nonexistent-id-0000000`),
      );
      expect(res.status).toBe(404);
    });
  });
});
