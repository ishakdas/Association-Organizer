import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, TicketStatus } from '@ticketbot/database';
import { CreateTicketInput, UpdateTicketInput, TicketQueryInput } from '@ticketbot/shared-validation';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateTicketInput, organisationId: string, creatorId: string) {
    const ticket = await this.prisma.ticket.create({
      data: {
        ...input,
        organisationId,
        creatorId,
      },
    });

    await this.prisma.ticketStatusHistory.create({
      data: {
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: TicketStatus.OPEN,
      },
    });

    return ticket;
  }

  async findAll(organisationId: string, query: TicketQueryInput) {
    const { page, limit, status, priority, assigneeId } = query;
    const where = {
      organisationId,
      deletedAt: null,
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assigneeId && { assigneeId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, organisationId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, organisationId, deletedAt: null },
      include: {
        comments: { orderBy: { createdAt: 'asc' } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async update(id: string, organisationId: string, input: UpdateTicketInput) {
    const existing = await this.findOne(id, organisationId);

    // Track status change
    if (input.status && input.status !== existing.status) {
      await this.prisma.ticketStatusHistory.create({
        data: {
          ticketId: id,
          fromStatus: existing.status as TicketStatus,
          toStatus: input.status as TicketStatus,
        },
      });
    }

    return this.prisma.ticket.update({
      where: { id },
      data: input,
    });
  }

  async softDelete(id: string, organisationId: string) {
    await this.findOne(id, organisationId); // ensures exists + tenant check

    return this.prisma.ticket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
