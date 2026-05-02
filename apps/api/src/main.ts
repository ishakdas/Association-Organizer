import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { BotService } from 'bot';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const config = app.get(ConfigService);

  app.enableShutdownHooks();

  app.enableCors({
    origin: (origin, callback) => {
      // Allow all origins in development or matching webUrl
      callback(null, true);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-association-id, ngrok-skip-browser-warning',

  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());

  // Mount Telegram webhook outside the /api/v1 prefix
  const botService = app.get(BotService);
  const fastify = app.getHttpAdapter().getInstance();

  fastify.post('/telegram/webhook', async (request: any, reply: any) => {
    await botService.handleUpdate(request.body);
    return reply.send({ ok: true });
  });

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');

  // Set webhook URL only when apiUrl is publicly reachable. For local
  // dev (localhost / 127.0.0.1 / 0.0.0.0), BotService runs in long-
  // polling mode instead — registering a webhook here would cancel
  // that mode silently and break /start, /link in dev.
  const apiUrl = config.get<string>('apiUrl');
  const nodeEnv = config.get<string>('nodeEnv');
  const isPublicApiUrl =
    !!apiUrl &&
    !apiUrl.includes('localhost') &&
    !apiUrl.includes('127.0.0.1') &&
    !apiUrl.startsWith('http://0.0.0.0');
  if (isPublicApiUrl && nodeEnv !== 'test') {
    await botService.setWebhook(`${apiUrl}/telegram/webhook`).catch((err) => {
      console.warn('Failed to set webhook:', err.message);
    });
  }
}
bootstrap();
