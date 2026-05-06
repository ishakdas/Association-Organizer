import { Controller, Get, HttpCode } from '@nestjs/common';
import { PrismaService } from '@ticketbot/database';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(200)
  async check() {
    const timestamp = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', timestamp, db: 'up' };
    } catch {
      return { status: 'degraded', timestamp, db: 'down' };
    }
  }
}
