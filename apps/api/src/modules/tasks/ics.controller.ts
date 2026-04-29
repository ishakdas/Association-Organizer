import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { PrismaService } from '@ticketbot/database';
import { buildTaskIcs } from 'bot';
import { IcsTokenService } from './ics-token.service';

// Public, capability-token-protected ICS download.
// Lives under the `api/v1` global prefix at `/api/v1/tasks/:taskId/ics`.
// Auth is the signed `?t=` parameter — no AuthGuard on purpose so that
// any calendar client (Apple, Google, Outlook) can fetch the file
// without forwarding the user's session.
@Controller('tasks')
export class TaskIcsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: IcsTokenService,
  ) {}

  @Get(':taskId/ics')
  @Header('Cache-Control', 'no-store')
  async download(
    @Param('taskId') taskId: string,
    @Query('t') token: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    if (!this.tokens.verifyTaskIcsToken(taskId, token)) {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş bağlantı');
    }

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        updatedAt: true,
      },
    });
    if (!task || !task.dueDate) {
      throw new NotFoundException('Görev veya bitiş tarihi bulunamadı');
    }

    const ics = buildTaskIcs(
      {
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        updatedAt: task.updatedAt,
      },
      this.tokens.uidDomain(),
    );

    reply.header('Content-Type', 'text/calendar; charset=utf-8');
    reply.header(
      'Content-Disposition',
      `attachment; filename="task-${task.id}.ics"`,
    );
    return ics;
  }
}
