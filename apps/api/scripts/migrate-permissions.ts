/**
 * Migration script: Convert existing roles to permissions
 * 
 * Run with: npx ts-node apps/api/scripts/migrate-permissions.ts
 * 
 * Rules:
 * - ASSOCIATION_MANAGER: All permissions (already bypassed by role check)
 * - ASSOCIATION_SECRETARY: All permissions except MANAGE_MEMBERS and MANAGE_ASSOCIATION_SETTINGS
 * - ASSOCIATION_MEMBER: VIEW_* + CREATE_TASKS + CREATE_MEETINGS + CREATE_TRANSACTIONS
 */

import { PrismaClient, PermissionAction, UserRole } from '@ticketbot/database';

const prisma = new PrismaClient();

const SECRETARY_PERMISSIONS: PermissionAction[] = [
  'VIEW_MEMBERS',
  'VIEW_TASKS',
  'CREATE_TASKS',
  'ASSIGN_TASKS',
  'UPDATE_TASK_STATUS',
  'DELETE_TASKS',
  'VIEW_MEETINGS',
  'CREATE_MEETINGS',
  'EDIT_MEETINGS',
  'DELETE_MEETINGS',
  'VIEW_EVENTS',
  'CREATE_EVENTS',
  'EDIT_EVENTS',
  'DELETE_EVENTS',
  'MANAGE_EVENT_ASSIGNMENTS',
  'VIEW_FINANCE',
  'CREATE_TRANSACTIONS',
  'DELETE_TRANSACTIONS',
  'MANAGE_CATEGORIES',
  'MANAGE_FINANCE_SETTINGS',
];

const MEMBER_PERMISSIONS: PermissionAction[] = [
  'VIEW_MEMBERS',
  'VIEW_TASKS',
  'CREATE_TASKS',
  'UPDATE_TASK_STATUS',
  'VIEW_MEETINGS',
  'CREATE_MEETINGS',
  'EDIT_MEETINGS',
  'VIEW_EVENTS',
  'CREATE_EVENTS',
  'VIEW_FINANCE',
  'CREATE_TRANSACTIONS',
];

async function main() {
  console.log('Starting permission migration...');

  const memberships = await prisma.associationMembership.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      role: {
        in: [UserRole.ASSOCIATION_SECRETARY, UserRole.ASSOCIATION_MEMBER],
      },
    },
    select: {
      id: true,
      userId: true,
      associationId: true,
      role: true,
    },
  });

  console.log(`Found ${memberships} memberships to migrate`);

  let created = 0;
  let skipped = 0;

  for (const membership of memberships) {
    const permissions =
      membership.role === UserRole.ASSOCIATION_SECRETARY
        ? SECRETARY_PERMISSIONS
        : MEMBER_PERMISSIONS;

    for (const action of permissions) {
      try {
        await prisma.permission.create({
          data: {
            associationId: membership.associationId,
            userId: membership.userId,
            action,
          },
        });
        created++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          skipped++;
        } else {
          throw error;
        }
      }
    }
  }

  console.log(`Migration complete: ${created} created, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
