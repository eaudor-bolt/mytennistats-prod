/*
  # Stop new functions being born anon-callable

  ## The reported root cause, and a correction

  The database carries:

      ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
        GRANT ALL ON FUNCTIONS TO "anon";        -- and TO "authenticated"

  The suggested fix was:

      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

  That does not work, and it is worth being precise about why, because the
  one-liner looks like it should. `pg_default_acl` stores only the *extra*
  grants layered on top of PostgreSQL's built-in default for the object type.
  The built-in default for a function is `EXECUTE TO PUBLIC` - and `anon` is a
  member of PUBLIC. Revoking anon from the default privileges removes the
  redundant explicit grant and leaves the built-in PUBLIC grant untouched, so
  the next function is still anon-callable.

  Verified on PostgreSQL 15 and 17: after
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM
  PUBLIC`, `pg_default_acl` holds zero rows and a freshly created function has
  `proacl = NULL` (i.e. the built-in default) with
  `has_function_privilege('anon', ..., 'EXECUTE') = true`. Revoking from
  PUBLIC in default privileges cannot suppress PUBLIC's built-in grant.

  So the enforcement here is an event trigger, which fires on every
  `CREATE FUNCTION` in `public` and revokes the grant immediately. That is
  the only mechanism that makes "born locked" automatic rather than a thing
  someone has to remember.

  ## What this migration does

  1. Removes the redundant explicit anon/authenticated default grants.
     Hygiene only - by itself it changes nothing, per the above.
  2. Re-sweeps existing functions with a corrected filter (see below).
  3. Re-grants each function the one role it needs.
  4. Adds `pg_temp` to the two view-counter functions.
  5. Makes the two legacy storage buckets private and size-capped.
  6. Installs the event trigger, last, so it cannot interfere with 2-4.

  ## The previous sweep's filter was too narrow

  It selected on `has_function_privilege('public', p.oid, 'EXECUTE')` - the
  PUBLIC pseudo-role - while the grants above are explicit `TO anon`. A
  function whose PUBLIC grant had been revoked but whose anon grant remained
  was skipped. Confirmed in a fixture: such a function reports
  `has_function_privilege('public', ...) = false` and
  `has_function_privilege('anon', ...) = true`. This sweep tests anon and
  authenticated directly.
*/

-- ---------------------------------------------------------------------------
-- 1. Drop the redundant explicit default grants (hygiene; not sufficient alone)
-- ---------------------------------------------------------------------------

/*
  You can only change default privileges for a role you are a member of, so on
  a hosted project the migration role (`postgres`) cannot touch
  `supabase_admin`'s. That is not worth failing the migration over - this whole
  step is hygiene, and the enforcement that matters is the event trigger in
  section 6 - so each role is attempted independently and a refusal is noted
  and skipped.
*/
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['postgres', 'supabase_admin']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      BEGIN
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated',
          r
        );
        RAISE NOTICE 'cleared default function grants for role %', r;
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped default privileges for role % (not permitted; harmless)', r;
      END;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Re-sweep, testing anon and authenticated directly
-- ---------------------------------------------------------------------------

/*
  The NOTICE output is the audit trail. It should name every SECURITY DEFINER
  function still reachable by anon or authenticated at the moment this runs -
  including any created outside this repo.
*/
DO $$
DECLARE
  fn record;
  n integer := 0;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype NOT IN ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)
      AND d.objid IS NULL
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('public', p.oid, 'EXECUTE')
      )
  LOOP
    n := n + 1;
    RAISE NOTICE 'reachable: %  (anon=%, authenticated=%)', fn.sig, fn.anon_can, fn.auth_can;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
  END LOOP;

  RAISE NOTICE 'swept % SECURITY DEFINER function(s)', n;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Re-grant, explicitly, per function
-- ---------------------------------------------------------------------------

/*
  The full set of SECURITY DEFINER functions in this database, taken from the
  2026-08-06 production snapshot. `initialize_new_user` is a trigger function
  and needs no role grant. Anything not listed stays locked.
*/
DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      -- Public share links: opened by logged-out visitors by design.
      ('public.get_public_match_result(uuid)',                       'anon, authenticated'),
      ('public.get_shared_match_results(uuid)',                      'anon, authenticated'),
      ('public.get_live_match(uuid)',                                'anon, authenticated'),
      ('public.increment_live_match_views(uuid)',                    'anon, authenticated'),
      ('public.increment_shared_result_views(uuid)',                 'anon, authenticated'),
      -- Signed-in users only.
      ('public.increment_usage_stat(text, bigint)',                  'authenticated'),
      ('public.ensure_default_player(uuid)',                         'authenticated'),
      ('public.delete_user_account(uuid)',                           'authenticated'),
      -- Edge functions, which connect with the service role.
      ('public.consume_ai_rate_limit(uuid, text, integer, integer)', 'service_role'),
      ('public.prune_ai_usage_events()',                             'service_role')
    ) AS t(sig, roles)
  LOOP
    BEGIN
      IF to_regprocedure(spec.sig) IS NOT NULL THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %s', spec.sig, spec.roles);
      ELSE
        RAISE NOTICE 'Skipping grant, function not present: %', spec.sig;
      END IF;
    EXCEPTION WHEN undefined_object THEN
      RAISE NOTICE 'Skipping grant, signature unresolvable: %', spec.sig;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. View counters: missing pg_temp
-- ---------------------------------------------------------------------------

/*
  `SET search_path = public` omits pg_temp. In a SECURITY DEFINER function a
  caller who can create temporary objects could otherwise shadow an
  unqualified name and have the definer run it. Pinning pg_temp last is the
  standard mitigation and matches the other functions here.

  These stay anon-callable: counting opens of a public share link is the whole
  point. The count is a soft metric - an unauthenticated counter is inflatable
  by anyone who can call it, and no amount of SQL fixes that. See README.
*/
CREATE OR REPLACE FUNCTION public.increment_live_match_views(p_match_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE live_matches SET view_count = view_count + 1 WHERE id = p_match_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_shared_result_views(p_share_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE shared_match_results SET view_count = view_count + 1 WHERE id = p_share_id;
$$;

REVOKE ALL ON FUNCTION public.increment_live_match_views(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_shared_result_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_live_match_views(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_shared_result_views(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Legacy storage buckets
-- ---------------------------------------------------------------------------

/*
  Nothing in `src/` calls `supabase.storage` any more - video upload and
  delete go through S3/CloudFront via the presign-upload and
  delete-video-from-s3 edge functions. These two buckets are left over from
  the pre-S3 pipeline. Both are `public = true`, and `match-videos` has no
  size limit at all.

  They are made private and size-capped rather than dropped: dropping a bucket
  destroys any objects still in it, and this migration cannot know whether the
  old recordings still matter. Deleting them, once the contents are confirmed
  dead, is a separate deliberate step.
*/
/*
  `storage.buckets` is owned by `supabase_storage_admin`, so the migration role
  may not be able to write it. Guarded for the same reason as section 1: a
  refusal here should not roll back the function lockdown. If it is skipped,
  flip both buckets to private in Dashboard -> Storage -> Settings instead.
*/
DO $$
BEGIN
  UPDATE storage.buckets
  SET public = false,
      file_size_limit = COALESCE(file_size_limit, 52428800)
  WHERE id IN ('match-videos', 'recorded-videos');
  RAISE NOTICE 'storage buckets set private and size-capped';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Could not update storage.buckets - set match-videos and recorded-videos to private in the dashboard.';
  WHEN undefined_table THEN
    RAISE NOTICE 'storage.buckets not present, skipping';
END $$;

-- ---------------------------------------------------------------------------
-- 6. The actual enforcement: lock every new function at creation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lock_down_new_functions()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE object_type = 'function' AND schema_name = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', obj.object_identity);
    RAISE NOTICE 'lock_down_new_functions: revoked PUBLIC/anon/authenticated on %', obj.object_identity;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.lock_down_new_functions() IS
  'Event trigger body. New functions in public are born with EXECUTE granted to PUBLIC (which includes anon); default privileges cannot suppress that, so this revokes it at creation. Grant explicitly afterwards.';

/*
  Creating an event trigger requires superuser. On a hosted project the
  migration role may not have it, so this is guarded: if it cannot be
  installed the migration still succeeds, and the protection falls back to
  the sweep above plus the checklist in README. The NOTICE says which.
*/
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'lock_down_new_functions_trg') THEN
    RAISE NOTICE 'event trigger already installed';
  ELSE
    EXECUTE $ddl$
      CREATE EVENT TRIGGER lock_down_new_functions_trg
        ON ddl_command_end
        WHEN TAG IN ('CREATE FUNCTION')
        EXECUTE FUNCTION public.lock_down_new_functions()
    $ddl$;
    RAISE NOTICE 'event trigger installed: new functions are now born locked';
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Could not create event trigger (needs superuser). New functions will still be born anon-callable - follow the REVOKE checklist in README.';
END $$;
