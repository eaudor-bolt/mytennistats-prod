/*
  # INCIDENT: unauthenticated account deletion

  ## What was live

  `delete_user_account(uuid)` was callable by anonymous visitors and deleted
  the named account outright - every row across shared_match_results,
  live_matches, match_results, convocations, tournament_registrations,
  user_players, user_usage_stats, user_feature_flags, user_subscriptions,
  user_profiles, and finally auth.users. Verified live: an anon POST with a
  UUID matching no rows returned 204, meaning the function ran to completion
  rather than raising.

  The one input it needs was published: `tournament_comments` was readable by
  anon and returns `user_id` next to `author_name`.

  ## Two independent bugs, both required

  1. The guard was NULL-unsafe:

         IF auth.uid() != p_user_id THEN RAISE EXCEPTION ...

     For an anonymous caller `auth.uid()` is NULL, and `NULL != <anything>`
     evaluates to NULL - not TRUE. `IF NULL THEN` does not branch, so the
     guard never fired and execution fell straight through to the deletes.
     The comparison has to be NULL-safe *and* NULL has to be rejected
     explicitly.

  2. `anon` had EXECUTE. Postgres grants EXECUTE to PUBLIC on every new
     function by default, and PUBLIC includes anon. `GRANT ... TO
     authenticated` does not remove that; only an explicit REVOKE does.
     Neither original migration revoked it, so the function was reachable by
     anyone with the public anon key.

  `ensure_default_player(uuid)` had the identical pair of bugs. Anonymous
  execution reached the INSERT and failed only on a foreign key (409,
  user_players_user_id_fkey) - proof the guard was skipped. With a real user
  id it would insert a player row into someone else's account.

  ## The standing rule

  A SECURITY DEFINER function bypasses RLS by design, so leaving PUBLIC's
  default EXECUTE in place makes it anon-callable no matter how careful its
  body is. The only functions that were safe here are the ones written with
  an explicit REVOKE. This migration therefore sweeps *every* SECURITY
  DEFINER function in `public` rather than only the two known-bad ones, and
  re-grants the specific roles each one actually needs.

  Non-SECURITY-DEFINER functions are left alone: they run with the caller's
  own privileges, so RLS still applies to them.
*/

-- ---------------------------------------------------------------------------
-- 1. The two broken functions, with NULL-safe guards
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- NULL-safe: an anonymous caller (auth.uid() IS NULL) is rejected here
  -- rather than falling through a NULL comparison.
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'You can only delete your own account';
  END IF;

  DELETE FROM shared_match_results WHERE user_id = p_user_id;
  DELETE FROM live_matches WHERE user_id = p_user_id;
  DELETE FROM match_results WHERE user_id = p_user_id;
  DELETE FROM convocations WHERE user_id = p_user_id;
  DELETE FROM tournament_registrations WHERE user_id = p_user_id;
  DELETE FROM user_players WHERE user_id = p_user_id;
  DELETE FROM user_usage_stats WHERE user_id = p_user_id;
  DELETE FROM user_feature_flags WHERE user_id = p_user_id;
  DELETE FROM user_subscriptions WHERE user_id = p_user_id;
  DELETE FROM user_profiles WHERE id = p_user_id;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_default_player(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_birth_year integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'You can only create a default player for your own account';
  END IF;

  -- Serializes concurrent calls for this same user only; other users'
  -- calls proceed independently and are unaffected.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  IF EXISTS (SELECT 1 FROM user_players WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  SELECT first_name, last_name, birth_year
    INTO v_first_name, v_last_name, v_birth_year
    FROM user_profiles
    WHERE id = p_user_id;

  INSERT INTO user_players (user_id, first_name, last_name, birth_year, license_number)
  VALUES (
    p_user_id,
    COALESCE(v_first_name, 'Player'),
    COALESCE(v_last_name, ''),
    COALESCE(v_birth_year, EXTRACT(YEAR FROM now())::int - 30),
    ''
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Sweep PUBLIC's default EXECUTE off every SECURITY DEFINER function
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public'
      AND p.prosecdef                              -- SECURITY DEFINER only
      AND p.prorettype <> 'pg_catalog.trigger'::regtype
      AND d.objid IS NULL                          -- not owned by an extension
      AND has_function_privilege('public', p.oid, 'EXECUTE')
  LOOP
    RAISE NOTICE 'Revoking PUBLIC EXECUTE on %', fn.sig;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Re-grant, per function, only the role that calls it
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      -- Public share links: called by logged-out visitors by design.
      ('public.get_public_match_result(uuid)',                      'anon, authenticated'),
      ('public.get_shared_match_results(uuid)',                     'anon, authenticated'),
      ('public.get_live_match(uuid)',                               'anon, authenticated'),
      -- Signed-in users only.
      ('public.increment_usage_stat(text, bigint)',                 'authenticated'),
      ('public.ensure_default_player(uuid)',                        'authenticated'),
      ('public.delete_user_account(uuid)',                          'authenticated'),
      -- Edge functions, which connect with the service role.
      ('public.consume_ai_rate_limit(uuid, text, integer, integer)', 'service_role'),
      ('public.prune_ai_usage_events()',                            'service_role'),
      ('public.search_tennis_rules(vector, double precision, integer, text)', 'service_role')
    ) AS t(sig, roles)
  LOOP
    BEGIN
      IF to_regprocedure(spec.sig) IS NOT NULL THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %s', spec.sig, spec.roles);
      ELSE
        RAISE NOTICE 'Skipping grant, function not present: %', spec.sig;
      END IF;
    EXCEPTION WHEN undefined_object THEN
      -- e.g. a signature naming a type this database does not have.
      -- Skip rather than abort the whole migration.
      RAISE NOTICE 'Skipping grant, signature unresolvable: %', spec.sig;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Remove the public source of user UUIDs
-- ---------------------------------------------------------------------------

/*
  `tournament_comments` returned `user_id` alongside `author_name` to anyone
  with the anon key, which is where an attacker got the UUID to feed to
  delete_user_account. The comment board lives inside the authenticated app
  (TournamentModal, reachable only from the tournaments page), so anon never
  needed to read it.
*/
DROP POLICY IF EXISTS "Public can view all tournament comments" ON tournament_comments;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tournament_comments'
      AND policyname = 'Authenticated users can view tournament comments'
  ) THEN
    CREATE POLICY "Authenticated users can view tournament comments"
      ON tournament_comments FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

REVOKE ALL ON TABLE tournament_comments FROM anon;
