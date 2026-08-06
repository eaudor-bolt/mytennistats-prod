/*
  # Track individual match shares ("shared-game" links)

  1. Problem
    - Unlike Live Score sessions (`live_matches`, one row per share) and
      multi-match result shares (`shared_match_results`, one row per share),
      an individual match share (`/shared-game/{matchId}`, formerly
      `/match-history/{matchId}`) has no dedicated "this was shared" record
      at all - `get_public_match_result(uuid)` will happily serve *any*
      match_results row by id, shared or not. Settings -> Shared Links can't
      list these because there's nothing in the DB distinguishing "the user
      clicked Share on this match" from "this match merely exists".

  2. Fix
    - `match_results.shared_at` - set the first (and, on re-share, each)
      time the share button is used. Written directly by the client via the
      existing owner-scoped UPDATE policy - no RPC needed, this is the
      user's own row.
    - `match_results.view_count` - same pattern as the other two share
      types: incremented by an anon-callable SECURITY DEFINER RPC, called
      once per page load of the public viewer.
*/

ALTER TABLE match_results
  ADD COLUMN IF NOT EXISTS shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_match_result_views(p_match_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE match_results SET view_count = view_count + 1 WHERE id = p_match_id;
$$;

-- The event trigger installed in 20260806140000 revokes PUBLIC/anon/authenticated
-- on every newly created function in public; grant back explicitly, same as
-- increment_live_match_views / increment_shared_result_views.
REVOKE ALL ON FUNCTION public.increment_match_result_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_match_result_views(uuid) TO anon, authenticated;
