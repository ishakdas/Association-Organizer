import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaService } from '@ticketbot/database';
import request from 'supertest';
import {
  createTestApp,
  seedTestUser,
  truncateAssociations,
} from './utils/test-app.factory';
import { TEST_BEARER_TOKEN, TEST_USER_ID } from './utils/test-user';

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

  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${TEST_BEARER_TOKEN}`);

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

    it('3) returns 201 with body and persists to DB when payload is valid', async () => {
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
        city: 'Ankara',
        createdById: TEST_USER_ID,
      });

      const row = await prisma.association.findUnique({
        where: { id: res.body.id },
      });
      expect(row).not.toBeNull();
      expect(row?.taxNumber).toBe('1234567890');
      expect(row?.createdById).toBe(TEST_USER_ID);
    });

    it('4) returns 409 when taxNumber already exists', async () => {
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
              name: 'Another Dernek',
              email: 'other@dernek.org',
            }),
          ),
      );
      expect(dupe.status).toBe(409);
    });
  });

  describe('GET /associations', () => {
    it('5) returns correct pagination meta (total, page, pageSize, totalPages)', async () => {
      const rows = Array.from({ length: 3 }).map((_, i) => ({
        name: `Dernek ${i + 1}`,
        taxNumber: `100000000${i}`,
        foundedAt: new Date('2020-01-01T00:00:00.000Z'),
        address: 'Adres',
        city: 'Ankara',
        district: 'Çankaya',
        phone: '+905551112233',
        email: `a${i}@dernek.org`,
        activityArea: 'Eğitim',
        presidentName: 'Başkan',
        memberCount: 10,
        isActive: true,
        createdById: TEST_USER_ID,
      }));
      for (const r of rows) await prisma.association.create({ data: r });

      const res = await auth(
        request(app.getHttpServer()).get(`${BASE}?page=1&pageSize=2`),
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        meta: { total: 3, page: 1, pageSize: 2, totalPages: 2 },
      });
      expect(res.body.data).toHaveLength(2);
    });

    it('6) applies the `search` filter', async () => {
      await prisma.association.createMany({
        data: [
          {
            name: 'TESTXYZ Derneği',
            taxNumber: '2000000001',
            foundedAt: new Date('2020-01-01T00:00:00.000Z'),
            address: 'A',
            city: 'Ankara',
            district: 'Çankaya',
            phone: '+905551112233',
            email: 't1@dernek.org',
            activityArea: 'Eğitim',
            presidentName: 'Başkan',
            memberCount: 1,
            isActive: true,
            createdById: TEST_USER_ID,
          },
          {
            name: 'Başka Dernek',
            taxNumber: '2000000002',
            foundedAt: new Date('2020-01-01T00:00:00.000Z'),
            address: 'B',
            city: 'İstanbul',
            district: 'Kadıköy',
            phone: '+905551112233',
            email: 't2@dernek.org',
            activityArea: 'Kültür',
            presidentName: 'Başkan',
            memberCount: 1,
            isActive: true,
            createdById: TEST_USER_ID,
          },
        ],
      });

      const res = await auth(
        request(app.getHttpServer()).get(`${BASE}?search=TESTXYZ`),
      );

      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('TESTXYZ Derneği');
    });
  });

  describe('GET /associations/:id', () => {
    it('7) returns 200 with the association when id is valid', async () => {
      const created = await prisma.association.create({
        data: {
          name: 'Detay Derneği',
          taxNumber: '3000000001',
          foundedAt: new Date('2020-01-01T00:00:00.000Z'),
          address: 'Adres',
          city: 'Ankara',
          district: 'Çankaya',
          phone: '+905551112233',
          email: 'detay@dernek.org',
          activityArea: 'Eğitim',
          presidentName: 'Başkan',
          memberCount: 1,
          isActive: true,
          createdById: TEST_USER_ID,
        },
      });

      const res = await auth(
        request(app.getHttpServer()).get(`${BASE}/${created.id}`),
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: created.id,
        taxNumber: '3000000001',
      });
    });

    it('8) returns 404 when id does not exist', async () => {
      const res = await auth(
        request(app.getHttpServer()).get(`${BASE}/ck-nonexistent-id-0000000`),
      );
      expect(res.status).toBe(404);
    });
  });
});
