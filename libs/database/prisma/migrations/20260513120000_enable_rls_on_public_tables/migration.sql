-- Enable Row Level Security on every table in the `public` schema.
--
-- Architecture context:
--   * The web app talks to the NestJS API, never to PostgREST directly.
--   * The NestJS API uses Prisma over DATABASE_URL (postgres role, BYPASSRLS).
--   * Supabase admin operations use the service_role key (also bypasses RLS).
--   * The exposed anon key therefore must not be able to read or write any
--     data table through PostgREST. Enabling RLS with no policies achieves
--     exactly that: anon / authenticated roles get zero rows back.
--
-- This addresses the Supabase advisor warning `rls_disabled_in_public`.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            r.schemaname,
            r.tablename
        );
    END LOOP;
END $$;
