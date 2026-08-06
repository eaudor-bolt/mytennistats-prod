/*
  # View counters for shared links (Live Score + Match Result)

  1. Problem
    - The owner has no way to know whether a shared /live/{id} or
      /shared-results/{id} link was ever actually opened by whoever they
      sent it to.

  2. Fix
    - Add a `view_count` column to both `live_matches` and
      `shared_match_results`, defaulting to 0 for existing rows.
    - Add two SECURITY DEFINER increment functions, one per table, granted
      to `anon` + `authenticated` (mirrors `get_live_match` /
      `get_shared_match_results`, the read-side RPCs these pages already
      call - neither table is readable/writable directly by an anonymous
      visitor under RLS). Each does a single atomic `UPDATE ... SET
      view_count = view_count + 1`, scoped to the row id only - no data is
      returned, so this can't be used to probe for existing ids.
    - The increment is fire-and-forget from the client, called once per
      page load of the viewer page (not the owner's own scoring/edit UI),
      so it counts "the link was opened", not "the owner looked at their
      own data".
*/

ALTER TABLE live_matches
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

ALTER TABLE shared_match_results
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_live_match_views(p_match_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE live_matches SET view_count = view_count + 1 WHERE id = p_match_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_shared_result_views(p_share_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE shared_match_results SET view_count = view_count + 1 WHERE id = p_share_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_live_match_views(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_shared_result_views(uuid) TO anon, authenticated;
