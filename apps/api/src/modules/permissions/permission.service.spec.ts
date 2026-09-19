import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { PermissionAction, PrismaClient, PrismaService } from '@ticketbot/database';
import { PermissionService } from './permission.service';

describe('PermissionService title-derived permissions', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: PermissionService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new PermissionService(prisma as unknown as PrismaService);
  });

  it('replaces stale title permissions with permissions from the selected title', async () => {
    prisma.memberTitleDefinition.findMany.mockResolvedValue([
      { slug: 'mali-isler-sorumlusu' },
    ] as never);

    await service.applyTitleDerivedPermissions('association-1', 'user-1', ['title-finance']);

    expect(prisma.permission.deleteMany).toHaveBeenCalledWith({
      where: {
        associationId: 'association-1',
        userId: 'user-1',
        action: { in: [PermissionAction.USE_MEETING_COMMANDS] },
      },
    });
    expect(prisma.permission.createMany).toHaveBeenCalledWith({
      data: [
        {
          associationId: 'association-1',
          userId: 'user-1',
          action: PermissionAction.USE_FINANCE_COMMANDS,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('removes every title-derived permission when the title is cleared', async () => {
    await service.applyTitleDerivedPermissions('association-1', 'user-1', [null]);

    expect(prisma.memberTitleDefinition.findMany).not.toHaveBeenCalled();
    expect(prisma.permission.deleteMany).toHaveBeenCalledWith({
      where: {
        associationId: 'association-1',
        userId: 'user-1',
        action: {
          in: [PermissionAction.USE_MEETING_COMMANDS, PermissionAction.USE_FINANCE_COMMANDS],
        },
      },
    });
    expect(prisma.permission.createMany).not.toHaveBeenCalled();
  });
});
