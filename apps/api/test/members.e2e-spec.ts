import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaService, UserRole } from '@ticketbot/database';
import request from 'supertest';
import {
  createTestApp,
  seedTestUser,
  truncateAssociations,
} from './utils/test-app.factory';
import { TEST_BEARER_TOKEN, TEST_USER_ID } from './utils/test-user';

const ASSOC_BASE = '/api/v1/associations';

const buildAssociation = (overrides: Record<string, unknown> = {}) => ({
  name: 'Mem E2E Derneği',
  shortName: 'MED',
  taxNumber: '7777777777',
  foundedAt: '2020-01-01T00:00:00.000Z',
  address: 'Test Mah. No:1',
  city: 'İstanbul',
  district: 'Kadıköy',
  phone: '+905551112233',
  email: 'mem-e2e@dernek.org',
  activityArea: 'Eğitim',
  memberCount: 5,
  isActive: true,
  manager: {
    fullName: 'Mehmet Başkan',
    email: 'mem-e2e-baskan@dernek.local',
    password: 'super-strong-pass',
    phone: '+905554445566',
  },
  ...overrides,
});

describe('AssociationMembers (e2e)', () => {
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

  async function seedAssociation(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(ASSOC_BASE)
      .set('Authorization', `Bearer ${TEST_BEARER_TOKEN}`)
      .send(buildAssociation())
      .expect(201);
    return res.body.id as string;
  }

  describe('POST /associations/:id/members', () => {
    it('creates a DB-only Üye when no password is provided', async () => {
      const associationId = await seedAssociation();

      const res = await request(app.getHttpServer())
        .post(`${ASSOC_BASE}/${associationId}/members`)
        .set('Authorization', `Bearer ${TEST_BEARER_TOKEN}`)
        .send({
          fullName: 'Ali Üye',
          email: 'ali-uye@dernek.local',
          role: 'ASSOCIATION_MEMBER',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        role: 'ASSOCIATION_MEMBER',
        isActive: true,
      });

      const user = await prisma.user.findUnique({
        where: { id: res.body.userId },
      });
      expect(user?.supabaseUserId).toBeNull();
    });

    it('provisions Supabase auth when role=SECRETARY with password', async () => {
      const associationId = await seedAssociation();

      const res = await request(app.getHttpServer())
        .post(`${ASSOC_BASE}/${associationId}/members`)
        .set('Authorization', `Bearer ${TEST_BEARER_TOKEN}`)
        .send({
          fullName: 'Ayşe Sekreter',
          email: 'ayse-sek@dernek.local',
          role: 'ASSOCIATION_SECRETARY',
          password: 'super-strong-pass',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        role: 'ASSOCIATION_SECRETARY',
        isActive: true,
      });

      const user = await prisma.user.findUnique({
        where: { id: res.body.userId },
      });
      expect(user?.supabaseUserId).not.toBeNull();
    });

    it('rejects SECRETARY without password (400)', async () => {
      const associationId = await seedAssociation();

      const res = await request(app.getHttpServer())
        .post(`${ASSOC_BASE}/${associationId}/members`)
        .set('Authorization', `Bearer ${TEST_BEARER_TOKEN}`)
        .send({
          fullName: 'Pwd-less Sekreter',
          email: 'no-pwd-sek@dernek.local',
          role: 'ASSOCIATION_SECRETARY',
        });

      expect(res.status).toBe(400);
    });

    it('rejects SECRETARY without email (400)', async () => {
      const associationId = await seedAssociation();

      const res = await request(app.getHttpServer())
        .post(`${ASSOC_BASE}/${associationId}/members`)
        .set('Authorization', `Bearer ${TEST_BEARER_TOKEN}`)
        .send({
          fullName: 'No Email',
          role: 'ASSOCIATION_SECRETARY',
          password: 'super-strong-pass',
        });

      expect(res.status).toBe(400);
    });

    it('rejects SECRETARY with weak password (<8 chars)', async () => {
      const associationId = await seedAssociation();

      const res = await request(app.getHttpServer())
        .post(`${ASSOC_BASE}/${associationId}/members`)
        .set('Authorization', `Bearer ${TEST_BEARER_TOKEN}`)
        .send({
          fullName: 'Weak Pwd',
          email: 'weak-pwd@dernek.local',
          role: 'ASSOCIATION_SECRETARY',
          password: '1234',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /associations/:id/members?role=...', () => {
    it('filters by ASSOCIATION_MANAGER and surfaces the seeded başkan', async () => {
      const associationId = await seedAssociation();

      const res = await request(app.getHttpServer())
        .get(`${ASSOC_BASE}/${associationId}/members?role=ASSOCIATION_MANAGER`)
        .set('Authorization', `Bearer ${TEST_BEARER_TOKEN}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].role).toBe('ASSOCIATION_MANAGER');
      expect(res.body[0].user.email).toBe('mem-e2e-baskan@dernek.local');
    });
  });

  // Sanity: the test bearer maps to TEST_USER_ID with SYSTEM_ADMIN.
  it('TEST_USER_ID has SYSTEM_ADMIN membership (sanity)', async () => {
    const m = await prisma.associationMembership.findFirst({
      where: { userId: TEST_USER_ID, role: UserRole.SYSTEM_ADMIN },
    });
    expect(m).not.toBeNull();
  });
});
