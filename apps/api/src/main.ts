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

  const webUrl = config.get<string>('webUrl');
  const nodeEnv = config.get<string>('nodeEnv');
  const isProd = nodeEnv === 'production';

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
  console.log('### [MAIN] BotService instance:', botService?.constructor?.name);
  console.log('### [MAIN] Has handleUpdate method:', typeof botService?.handleUpdate === 'function');
  console.log('### [MAIN] BotService prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(botService)));
  const fastify = app.getHttpAdapter().getInstance();

  fastify.post('/telegram/webhook', async (request: any, reply: any) => {
    process.stdout.write('\n### [WEBHOOK] START ###\n');
    console.log('[WEBHOOK] === Telegram Webhook Received ===');
    console.log('[WEBHOOK] Request body type:', typeof request.body);
    
    const body = request.body;
    if (!body) {
      console.error('[WEBHOOK] Empty body received');
      return reply.send({ ok: false });
    }
    
    const updateType = body.callback_query ? 'callback_query' : body.message ? 'message' : 'unknown';
    console.log('[WEBHOOK] Update type:', updateType);
    if (body.callback_query) {
      console.log('[WEBHOOK] Callback data:', body.callback_query.data);
    }
    
    process.stdout.write('### [WEBHOOK] About to call botService.handleUpdate ###\n');
    process.stdout.write('### [WEBHOOK] botService type: ' + typeof botService + ' ###\n');
    process.stdout.write('### [WEBHOOK] handleUpdate type: ' + typeof botService?.handleUpdate + ' ###\n');
    
    // DEBUG: Remove this after testing
    if (body?.callback_query?.data?.startsWith('mtg:')) {
      process.stdout.write('### [WEBHOOK] MEETING CALLBACK DETECTED: ' + body.callback_query.data + ' ###\n');
    }
    
    try {
      await botService.handleUpdate(body);
      process.stdout.write('### [WEBHOOK] handleUpdate returned ###\n');
      console.log('[WEBHOOK] Update processed successfully');
      return reply.send({ ok: true });
    } catch (err) {
      console.error('[WEBHOOK] Error handling update:', err);
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
    await botService.setWebhook(`${apiUrl}/telegram/webhook`).catch((err) => {
      console.warn('Failed to set webhook:', err.message);
    });
  }
}
bootstrap();
