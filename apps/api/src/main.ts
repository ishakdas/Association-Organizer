import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env files before anything else
const workspaceRoot = path.resolve(__dirname, '../../../..');
const possiblePaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(workspaceRoot, '.env.local'),
  path.resolve(workspaceRoot, '.env'),
  path.resolve(__dirname, '../../.env.local'),
  path.resolve(__dirname, '../../.env'),
];

for (const envPath of possiblePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    break;
  }
}

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import helmet from '@fastify/helmet';
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

  // Security headers (HSTS, X-Content-Type-Options, frame-ancestors, etc.).
  // CSP is disabled because this process serves JSON (and server-side PDFs),
  // not HTML pages, so a page-level CSP adds nothing. CORP is cross-origin so
  // the separate web frontend can still read API responses.
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  const webUrl = config.get<string>('webUrl');
  const nodeEnv = config.get<string>('nodeEnv');
  const isProd = nodeEnv === 'production';
  const webhookSecret = config.get<string>('bot.webhookSecret') ?? null;

  app.enableCors({
    origin: (origin, callback) => {
      // Same-origin / server-to-server requests have no Origin header
      if (!origin) return callback(null, true);
      if (isProd) {
        if (origin === webUrl) return callback(null, true);
        return callback(new Error(`CORS: origin ${origin} not allowed`), false);
      }
      return callback(null, true);
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
    // Reject forged updates: Telegram echoes our configured secret in this
    // header on every webhook call. When a secret is configured, anything
    // that doesn't match it is not from Telegram. (No secret configured →
    // accept, e.g. local long-polling dev where the webhook isn't used.)
    if (webhookSecret) {
      const headerToken = request.headers['x-telegram-bot-api-secret-token'];
      if (headerToken !== webhookSecret) {
        return reply.code(401).send({ ok: false });
      }
    }

    const body = request.body;
    if (!body) {
      return reply.send({ ok: false });
    }

    try {
      await botService.handleUpdate(body);
      return reply.send({ ok: true });
    } catch (err) {
      // Always 200 so Telegram doesn't retry-storm on a handler bug.
      console.error('[WEBHOOK] Error handling update:', (err as Error)?.message);
      return reply.send({ ok: true });
    }
  });

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');

  // Set webhook URL only when apiUrl is publicly reachable. For local
  // dev (localhost / 127.0.0.1 / 0.0.0.0), BotService runs in long-
  // polling mode instead — registering a webhook here would cancel
  // that mode silently and break /start, /link in dev.
  const apiUrl = config.get<string>('apiUrl');
  const isPublicApiUrl =
    !!apiUrl &&
    !apiUrl.includes('localhost') &&
    !apiUrl.includes('127.0.0.1') &&
    !apiUrl.startsWith('http://0.0.0.0');
  if (isPublicApiUrl && nodeEnv !== 'test') {
    if (isProd && !webhookSecret) {
      console.warn(
        'TELEGRAM_WEBHOOK_SECRET is not set — the webhook will accept ' +
          'unauthenticated requests. Set it to reject forged updates.',
      );
    }
    await botService
      .setWebhook(`${apiUrl}/telegram/webhook`, webhookSecret ?? undefined)
      .catch((err) => {
        console.warn('Failed to set webhook:', err.message);
      });
  }
}
bootstrap();
