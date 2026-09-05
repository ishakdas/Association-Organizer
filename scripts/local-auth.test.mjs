import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureLocalAdmin, findAuthUserByEmail } from './local-auth.mjs';

test('finds an existing auth user without creating another user', async () => {
  const auth = {
    listUsers: async () => ({ data: { users: [{ id: 'auth-1', email: 'admin@dev.local' }] } }),
    createUser: async () => assert.fail('createUser should not run'),
  };
  const user = await findAuthUserByEmail(auth, 'ADMIN@DEV.LOCAL');
  assert.equal(user.id, 'auth-1');
});

test('creates and links a missing local admin', async () => {
  const auth = {
    listUsers: async () => ({ data: { users: [] } }),
    createUser: async () => ({ data: { user: { id: 'auth-2' } } }),
  };
  let input;
  const prisma = {
    user: {
      upsert: async (value) => {
        input = value;
        return value.update;
      },
    },
  };

  await ensureLocalAdmin(auth, prisma, 'admin@dev.local', 'password');

  assert.equal(input.where.email, 'admin@dev.local');
  assert.equal(input.update.supabaseUserId, 'auth-2');
  assert.equal(input.update.isSystemAdmin, true);
});

test('propagates Supabase failures', async () => {
  const failure = new Error('Supabase unavailable');
  const auth = { listUsers: async () => ({ data: { users: [] }, error: failure }) };

  await assert.rejects(findAuthUserByEmail(auth, 'admin@dev.local'), failure);
});
