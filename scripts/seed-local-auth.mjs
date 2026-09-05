import { createRequire } from 'node:module';
import { assertLocalEnvironment } from './local-environment.mjs';
import { ensureLocalAdmin } from './local-auth.mjs';

assertLocalEnvironment(process.env);

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../libs/database/node_modules/@prisma/client');
const { createClient } = require('../apps/api/node_modules/@supabase/supabase-js');
const email = process.env.LOCAL_ADMIN_EMAIL;
const password = process.env.LOCAL_ADMIN_PASSWORD;
if (!email || !password) throw new Error('Local admin credentials are missing');

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  await ensureLocalAdmin(supabase.auth.admin, prisma, email, password);
  process.stdout.write(`Local admin ready: ${email}\n`);
} finally {
  await prisma.$disconnect();
}
