-- Enable RLS on the Prisma-managed `_prisma_migrations` ledger table.
--
-- The earlier migration `20260513120000_enable_rls_on_public_tables`
-- intentionally skipped this table out of caution. Supabase's advisor
-- still flags it (rls_disabled_in_public on public._prisma_migrations).
--
-- Enabling RLS without policies is safe here because:
--   * Prisma connects as the `postgres` role, which has BYPASSRLS.
--   * `prisma migrate deploy` and `prisma migrate status` continue to
--     read and write this table normally.
--   * Anon / authenticated PostgREST clients lose the ability to see
--     migration history (which they should never have had anyway).

ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
