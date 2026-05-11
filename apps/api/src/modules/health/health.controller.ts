import { Controller, Get, HttpCode } from '@nestjs/common';
import { PrismaService } from '@ticketbot/database';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(200)
  async check() {
    const start = Date.now();
    const timestamp = new Date().toISOString();
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const dbMs = Date.now() - dbStart;
      const totalMs = Date.now() - start;
      return { status: 'ok', timestamp, db: 'up', dbMs, totalMs };
    } catch {
      return { status: 'degraded', timestamp, db: 'down' };
    }
  }

  // /ping does NOT touch the DB. If curl shows it returning fast but
  // /health shows full latency, the cost is in the DB roundtrip.
  // If both are slow, the cost is in Railway routing/edge.
  @Get('ping')
  @HttpCode(200)
  ping() {
    return { ok: true, t: Date.now() };
  }
}
