/**
 * Integration test for the partial unique index:
 *   "one active ASSOCIATION_MANAGER per association"
 *
 * Hits a real Postgres (docker-compose @ 5433). Skipped if DATABASE_URL is unset.
 */
import { PrismaClient, UserRole } from '@ticketbot/database';

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('AssociationMembership — one active manager per association', () => {
  const prisma = new PrismaClient();

  let associationId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const seedUser = await prisma.user.create({
      data: {
        fullName: 'Schema Test Seed',
        email: `schema-seed-${Date.now()}@test.local`,
      },
    });

    const association = await prisma.association.create({
      data: {
        name: 'Schema Test Derneği',
        taxNumber: `${Date.now()}`.slice(-10),
        foundedAt: new Date('2020-01-01'),
        address: 'Schema Test Mah.',
        city: 'Ankara',
        district: 'Çankaya',
        phone: '+905551112233',
        email: `schema-test-${Date.now()}@dernek.local`,
        activityArea: 'Test',
        createdById: seedUser.id,
      },
    });
    associationId = association.id;

    const userA = await prisma.user.create({
      data: { fullName: 'Manager A', email: `mgr-a-${Date.now()}@test.local` },
    });
    const userB = await prisma.user.create({
      data: { fullName: 'Manager B', email: `mgr-b-${Date.now()}@test.local` },
    });
    userAId = userA.id;
    userBId = userB.id;
  });

  afterAll(async () => {
    await prisma.associationMembership.deleteMany({ where: { associationId } });
    await prisma.association.deleteMany({ where: { id: associationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.$disconnect();
  });

  it('allows the first active ASSOCIATION_MANAGER for an association', async () => {
    const membership = await prisma.associationMembership.create({
      data: {
        associationId,
        userId: userAId,
        role: UserRole.ASSOCIATION_MANAGER,
        isActive: true,
      },
    });

    expect(membership.role).toBe(UserRole.ASSOCIATION_MANAGER);
    expect(membership.isActive).toBe(true);
    expect(membership.leftAt).toBeNull();
  });

  it('rejects a second active ASSOCIATION_MANAGER for the same association', async () => {
    await expect(
      prisma.associationMembership.create({
        data: {
          associationId,
          userId: userBId,
          role: UserRole.ASSOCIATION_MANAGER,
          isActive: true,
        },
      }),
    ).rejects.toMatchObject({
      // Postgres unique violation surfaces as Prisma error code P2002
      code: 'P2002',
    });
  });

  it('allows a second ASSOCIATION_MANAGER once the first leaves (leftAt set)', async () => {
    await prisma.associationMembership.updateMany({
      where: { associationId, userId: userAId },
      data: { isActive: false, leftAt: new Date() },
    });

    const second = await prisma.associationMembership.create({
      data: {
        associationId,
        userId: userBId,
        role: UserRole.ASSOCIATION_MANAGER,
        isActive: true,
      },
    });

    expect(second.role).toBe(UserRole.ASSOCIATION_MANAGER);
    expect(second.isActive).toBe(true);
  });
});
