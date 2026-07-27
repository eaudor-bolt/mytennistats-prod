/*
  # Per-user rate limiting for the paid-API edge functions

  ## Why

  `tennis-rules-chat` and `transcribe-audio` spend real money per call (Mistral
  embeddings + chat, Groq Whisper). Both were reachable by anyone holding the
  anon key, which ships in the browser bundle - so the bill was open-ended. The
  functions now require a real user, and this adds the second half: a ceiling
  per user so one authenticated account cannot burn the credits either.

  This is deliberately NOT the product quota. The free/premium limits in
  `user_usage_stats` (`rules_chat_responses` etc.) are the business rule and
  stay where they are; this is an abuse brake set well above normal use.

  ## Design

  `consume_ai_rate_limit` is a single atomic call: it counts the user's events
  inside the window and inserts one if there is room. Counting and inserting in
  one statement avoids the check-then-insert race that lets a burst of parallel
  requests all pass a separate count query.

  The table is only ever touched by the service role (which bypasses RLS), so
  RLS is enabled with no policies at all - clients cannot read or write it.
*/

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_lookup
  ON ai_usage_events (user_id, endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created_at
  ON ai_usage_events (created_at);

ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;

-- No policies: anon and authenticated get no access at all. Only the service
-- role (used by the edge functions) reaches this table.
REVOKE ALL ON TABLE ai_usage_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_ai_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window_start timestamptz := now() - make_interval(secs => p_window_seconds);
  v_used integer;
  v_oldest timestamptz;
BEGIN
  SELECT count(*), min(created_at)
    INTO v_used, v_oldest
    FROM ai_usage_events
   WHERE user_id = p_user_id
     AND endpoint = p_endpoint
     AND created_at > v_window_start;

  IF v_used >= p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'limit', p_limit,
      'retry_after_seconds',
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest + make_interval(secs => p_window_seconds) - now())))::integer)
    );
  END IF;

  INSERT INTO ai_usage_events (user_id, endpoint) VALUES (p_user_id, p_endpoint);

  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_used + 1,
    'limit', p_limit,
    'remaining', p_limit - v_used - 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_rate_limit(uuid, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_rate_limit(uuid, text, integer, integer) TO service_role;

COMMENT ON FUNCTION public.consume_ai_rate_limit(uuid, text, integer, integer) IS
  'Atomically records one paid-API call for a user and reports whether it was within the limit. Service role only.';

/*
  Housekeeping: the table only needs the current window. Anything older than a
  day is dead weight, so drop it opportunistically. Called by the edge
  functions on a sampled basis rather than requiring pg_cron.
*/
CREATE OR REPLACE FUNCTION public.prune_ai_usage_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM ai_usage_events WHERE created_at < now() - interval '1 day';
$$;

REVOKE ALL ON FUNCTION public.prune_ai_usage_events() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_ai_usage_events() TO service_role;
