/*
  # Lock down anonymous read access to user data

  ## Problem

  Four tables were readable in full by logged-out visitors. Verified against
  production with the anon key: `GET /rest/v1/match_results?select=*` returned
  all 93 rows, `videos` all 59 (including CloudFront URLs and player names),
  `shared_match_results` all 20 (with `user_id` and `match_results_ids`), and
  `live_matches` every row.

  The root cause is a wrong assumption recorded in
  `20251126213255_readd_public_match_results_access.sql`: that a policy of
  `USING (true)` is safe because "match result IDs are UUIDs (hard to guess)".
  PostgREST does not require guessing an id - it happily returns the whole
  table when no filter is supplied. RLS cannot express "only when the caller
  filtered by primary key", so `USING (true)` can never implement
  share-by-unguessable-link.

  ## Approach

  Anonymous visitors lose all direct table access to these four tables, and the
  three public pages go through `SECURITY DEFINER` functions that take the id as
  an argument. A function *can* enforce "one row, by id" - which is what the
  share links always meant.

  1. `REVOKE ALL ... FROM anon` on the four tables. This is the backstop that
     does not depend on knowing every policy: production has drifted from this
     repo (no migration here creates `videos` at all, yet a public SELECT policy
     is live on it), so dropping policies by name is not sufficient on its own.
     Without the table grant, no policy can re-open the table to anon.
  2. Drop the known permissive policies so the repo and production agree.
  3. Add the owner-scoped SELECT policies that the dropped policies were
     masking. In particular `live_matches` had no owner SELECT policy - the
     `USING (true)` one was granted to `public`, which covers `authenticated`
     too, so removing it without a replacement would break the owner's own
     reads (SettingsPage).
  4. Expose the three public read paths as RPCs, granted to `anon`.

  ## What still works

  - `/match-history/{id}`   -> `get_public_match_result(id)`
  - `/shared-results/{id}`  -> `get_shared_match_results(id)`
  - `/live/{id}`            -> `get_live_match(id)`

  All three strip `user_id` from the payload. The live page loses its Realtime
  subscription for logged-out viewers (Realtime enforces RLS, and anon now has
  no SELECT path); it falls back to the 15s polling it already performs.

  ## What is NOT fixed here

  The video files themselves sit behind a public CloudFront distribution and a
  `public = true` storage bucket with a `Public can view videos` policy
  (`20260117155005`). Anyone holding a URL can still fetch the file. This
  migration stops the *enumeration* of those URLs, which is what made them
  harvestable; signing the URLs is a separate change.
*/

-- ---------------------------------------------------------------------------
-- 1. Backstop: no direct table access for anonymous visitors
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE match_results FROM anon;
REVOKE ALL ON TABLE videos FROM anon;
REVOKE ALL ON TABLE shared_match_results FROM anon;
REVOKE ALL ON TABLE live_matches FROM anon;

-- ---------------------------------------------------------------------------
-- 2. Drop the permissive policies (named, then anything else reaching anon)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow public read of match results by ID" ON match_results;
DROP POLICY IF EXISTS "Allow public read of individual match results" ON match_results;
DROP POLICY IF EXISTS "Public can view shared match results" ON match_results;
DROP POLICY IF EXISTS "Public can view active shares" ON shared_match_results;
DROP POLICY IF EXISTS "Anyone can view live matches" ON live_matches;

-- Production has policies that exist in no migration (notably on `videos`).
-- Sweep any remaining SELECT policy on these tables that is reachable by anon.
-- Restricted to FOR SELECT so that no write policy is collaterally dropped.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('match_results', 'videos', 'shared_match_results', 'live_matches')
      AND cmd = 'SELECT'
      AND (roles && ARRAY['anon', 'public']::name[])
  LOOP
    RAISE NOTICE 'Dropping anon-reachable SELECT policy %.%', pol.tablename, pol.policyname;
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Owner-scoped SELECT policies
-- ---------------------------------------------------------------------------

-- `live_matches` relied on the dropped `USING (true)` policy for owner reads.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'live_matches'
      AND policyname = 'Users can view own live matches'
  ) THEN
    CREATE POLICY "Users can view own live matches"
      ON live_matches FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- `videos` is not created by any migration in this repo; make the owner-only
-- SELECT policy that 20260117155005 declared explicit and idempotent here.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'videos'
      AND policyname = 'Users can view their own videos'
  ) THEN
    CREATE POLICY "Users can view their own videos"
      ON videos FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_matches ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. Public read paths, as functions that require the id
-- ---------------------------------------------------------------------------

-- Returned as jsonb rather than a column list: production has drifted from this
-- repo before, and a jsonb projection keeps working when columns are added
-- while still letting us subtract `user_id` explicitly.

CREATE OR REPLACE FUNCTION public.get_public_match_result(p_match_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT to_jsonb(m) - 'user_id'
  FROM match_results m
  WHERE m.id = p_match_id;
$$;

COMMENT ON FUNCTION public.get_public_match_result(uuid) IS
  'Single match result by id for the public /match-history/{id} link. Requires the id, so the table cannot be enumerated. Omits user_id.';

CREATE OR REPLACE FUNCTION public.get_shared_match_results(p_share_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'player_names', s.player_names,
    'created_at', s.created_at,
    'expires_at', s.expires_at,
    'matches', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(m) - 'user_id' ORDER BY m.date DESC)
        FROM match_results m
        WHERE m.id = ANY(s.match_results_ids)
      ),
      '[]'::jsonb
    )
  )
  FROM shared_match_results s
  WHERE s.id = p_share_id
    AND s.is_active = true
    AND (s.expires_at IS NULL OR s.expires_at > now());
$$;

COMMENT ON FUNCTION public.get_shared_match_results(uuid) IS
  'Active share plus its match results, by share id, for /shared-results/{id}. Returns NULL when the share is missing, deactivated or expired. Omits user_id.';

CREATE OR REPLACE FUNCTION public.get_live_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT to_jsonb(l) - 'user_id'
  FROM live_matches l
  WHERE l.id = p_match_id;
$$;

COMMENT ON FUNCTION public.get_live_match(uuid) IS
  'Single live match by id for the public /live/{id} scoreboard. Omits user_id.';

REVOKE ALL ON FUNCTION public.get_public_match_result(uuid) FROM public;
REVOKE ALL ON FUNCTION public.get_shared_match_results(uuid) FROM public;
REVOKE ALL ON FUNCTION public.get_live_match(uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.get_public_match_result(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_match_results(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_match(uuid) TO anon, authenticated;
