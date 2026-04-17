import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ConfigModule } from '@nestjs/config';
import { PrismaService, PrismaModule } from '@ticketbot/database';
import { AppModule } from '../../app.module';

describe('TicketsController (integration)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let orgId: string;
  let adminUserId: string;
  let memberUserId: string;
  let adminToken: string;
  let memberToken: string;

  beforeAll(async () => {
    // Skip if no DATABASE_URL (CI without DB)
    if (!process.env.DATABASE_URL) {
      console.warn('Skipping integration test: DATABASE_URL not set');
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);

    // Seed test data
    const org = await prisma.organisation.create({
      data: { name: 'Test Org', slug: 'test-org-' + Date.now() },
    });
    orgId = org.id;

    const adminUser = await prisma.user.create({
      data: {
        email: `admin-${Date.now()}@test.com`,
        name: 'Test Admin',
        supabaseId: `test-admin-${Date.now()}`,
      },
    });
    adminUserId = adminUser.id;

    const memberUser = await prisma.user.create({
      data: {
        email: `member-${Date.now()}@test.com`,
        name: 'Test Member',
        supabaseId: `test-member-${Date.now()}`,
      },
    });
    memberUserId = memberUser.id;

    await prisma.membership.createMany({
      data: [
        { organisationId: orgId, userId: adminUserId, role: 'ADMIN' },
        { organisationId: orgId, userId: memberUserId, role: 'MEMBER' },
      ],
    });

    // Generate HS256 tokens for testing
    const jose = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret-min-32-chars-long!!!');

    adminToken = await new jose.SignJWT({ sub: adminUser.supabaseId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret);

    memberToken = await new jose.SignJWT({ sub: memberUser.supabaseId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret);
  });

  afterAll(async () => {
    if (prisma) {
      // Clean up test data
      await prisma.ticketStatusHistory.deleteMany({ where: { ticket: { organisationId: orgId } } });
      await prisma.ticket.deleteMany({ where: { organisationId: orgId } });
      await prisma.membership.deleteMany({ where: { organisationId: orgId } });
      await prisma.user.deleteMany({ where: { id: { in: [adminUserId, memberUserId] } } });
      await prisma.organisation.delete({ where: { id: orgId } });
    }
    if (app) {
      await app.close();
    }
  });

  it('admin creates a ticket, member lists tickets', async () => {
    if (!process.env.DATABASE_URL) return;

    // Admin creates a ticket
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-organisation-id': orgId,
      },
      payload: {
        title: 'Integration test ticket',
        description: 'Created during test',
        priority: 'HIGH',
        assigneeId: memberUserId,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const ticket = JSON.parse(createRes.body);
    expect(ticket.title).toBe('Integration test ticket');
    expect(ticket.status).toBe('OPEN');
    expect(ticket.organisationId).toBe(orgId);

    // Member lists tickets — should see the ticket
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/tickets',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'x-organisation-id': orgId,
      },
    });

    expect(listRes.statusCode).toBe(200);
    const result = JSON.parse(listRes.body);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data.some((t: any) => t.id === ticket.id)).toBe(true);
    expect(result.meta).toHaveProperty('total');

    // Clean up the created ticket
    await prisma.ticketStatusHistory.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
