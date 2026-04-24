export const TEST_USER_ID = 'ckv0000testuser00000000001';
export const TEST_USER_EMAIL = 'e2e-user@test.local';
export const TEST_USER_FULL_NAME = 'Test Sistem Admini';
export const TEST_SUPABASE_ID = '00000000-0000-0000-0000-000000000001';

// Sentinel association used purely as a carrier for the SYSTEM_ADMIN
// membership grant. The membership row is what makes the test user a
// system admin (systemRole derives from any active SYSTEM_ADMIN membership).
export const TEST_ROOT_ASSOCIATION_ID = 'ckv00000testrootassoc0001';

// Two tokens: SYSTEM_ADMIN (default) and a regular non-admin Supabase
// user for negative authorization tests.
export const TEST_BEARER_TOKEN = 'test-valid-bearer-token';
export const TEST_NON_ADMIN_BEARER_TOKEN = 'test-non-admin-bearer-token';
export const TEST_NON_ADMIN_USER_ID = 'ckv0000testnonadmin000001';
export const TEST_NON_ADMIN_EMAIL = 'e2e-nonadmin@test.local';
export const TEST_NON_ADMIN_FULL_NAME = 'Test Non-Admin';
export const TEST_NON_ADMIN_SUPABASE_ID = '00000000-0000-0000-0000-000000000002';
