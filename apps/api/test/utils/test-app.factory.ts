import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { PrismaService } from '@ticketbot/database';
import { AppModule } from '../../src/app.module';
import { AuthGuard } from '../../src/common/guards/auth.guard';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { TestAuthGuard } from './test-auth.guard';
import { TEST_SUPABASE_ID, TEST_USER_EMAIL, TEST_USER_ID } from './test-user';

export interface E2EContext {
  app: NestFastifyApplication;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<E2EContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(AuthGuard)
    .useClass(TestAuthGuard)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  );

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

export async function seedTestUser(prisma: PrismaService): Promise<void> {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      supabaseId: TEST_SUPABASE_ID,
    },
    update: {},
  });
}

export async function truncateAssociations(prisma: PrismaService): Promise<void> {
  await prisma.association.deleteMany({});
}
