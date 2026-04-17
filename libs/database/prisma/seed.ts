import { PrismaClient, Role, TicketStatus, TicketPriority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.extractedActionItem.deleteMany();
  await prisma.meetingNote.deleteMany();
  await prisma.ticketStatusHistory.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.deadlineExtensionRequest.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.telegramLinkToken.deleteMany();
  await prisma.telegramAccount.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();

  // Organisation
  const org = await prisma.organisation.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
    },
  });

  // Users
  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@acme.com',
      name: 'Sarah Super',
      supabaseId: 'supabase-super-admin-001',
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      name: 'Alex Admin',
      supabaseId: 'supabase-admin-001',
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@acme.com',
      name: 'Mike Manager',
      supabaseId: 'supabase-manager-001',
    },
  });

  const member = await prisma.user.create({
    data: {
      email: 'member@acme.com',
      name: 'Mary Member',
      supabaseId: 'supabase-member-001',
    },
  });

  // Memberships
  await prisma.membership.createMany({
    data: [
      { organisationId: org.id, userId: superAdmin.id, role: Role.SUPER_ADMIN },
      { organisationId: org.id, userId: admin.id, role: Role.ADMIN },
      { organisationId: org.id, userId: manager.id, role: Role.MANAGER },
      { organisationId: org.id, userId: member.id, role: Role.MEMBER },
    ],
  });

  // Tickets in different states
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const ticket1 = await prisma.ticket.create({
    data: {
      title: 'Fix login page redirect loop',
      description: 'Users are getting stuck in a redirect loop when trying to log in via SSO.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      organisationId: org.id,
      creatorId: admin.id,
      assigneeId: member.id,
      dueDate: threeDaysFromNow,
    },
  });

  const ticket2 = await prisma.ticket.create({
    data: {
      title: 'Update onboarding flow copy',
      description: 'Marketing wants the onboarding copy updated before the next release.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.MEDIUM,
      organisationId: org.id,
      creatorId: manager.id,
      assigneeId: admin.id,
      dueDate: oneWeekFromNow,
    },
  });

  const ticket3 = await prisma.ticket.create({
    data: {
      title: 'Upgrade database to PostgreSQL 16',
      description: 'Scheduled maintenance to upgrade from PG 15 to PG 16.',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.LOW,
      organisationId: org.id,
      creatorId: superAdmin.id,
      assigneeId: manager.id,
    },
  });

  // Status history for tickets
  await prisma.ticketStatusHistory.createMany({
    data: [
      { ticketId: ticket1.id, fromStatus: null, toStatus: TicketStatus.OPEN },
      { ticketId: ticket2.id, fromStatus: null, toStatus: TicketStatus.OPEN },
      { ticketId: ticket2.id, fromStatus: TicketStatus.OPEN, toStatus: TicketStatus.IN_PROGRESS },
      { ticketId: ticket3.id, fromStatus: null, toStatus: TicketStatus.OPEN },
      { ticketId: ticket3.id, fromStatus: TicketStatus.OPEN, toStatus: TicketStatus.IN_PROGRESS },
      {
        ticketId: ticket3.id,
        fromStatus: TicketStatus.IN_PROGRESS,
        toStatus: TicketStatus.RESOLVED,
      },
    ],
  });

  // A comment on ticket1
  await prisma.ticketComment.create({
    data: {
      content: 'I can reproduce this on Chrome and Firefox. Safari seems fine.',
      ticketId: ticket1.id,
      authorId: member.id,
    },
  });

  // Audit log entries
  await prisma.auditLog.createMany({
    data: [
      {
        action: 'ticket.created',
        entityType: 'Ticket',
        entityId: ticket1.id,
        userId: admin.id,
        organisationId: org.id,
      },
      {
        action: 'ticket.created',
        entityType: 'Ticket',
        entityId: ticket2.id,
        userId: manager.id,
        organisationId: org.id,
      },
      {
        action: 'ticket.created',
        entityType: 'Ticket',
        entityId: ticket3.id,
        userId: superAdmin.id,
        organisationId: org.id,
      },
    ],
  });

  console.log('Seed complete:');
  console.log(`  Organisation: ${org.name} (${org.id})`);
  console.log(`  Users: ${superAdmin.name}, ${admin.name}, ${manager.name}, ${member.name}`);
  console.log(`  Tickets: ${ticket1.title}, ${ticket2.title}, ${ticket3.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
