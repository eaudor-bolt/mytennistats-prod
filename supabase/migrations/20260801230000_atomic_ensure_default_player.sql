/*
  # Atomic ensure_default_player function

  1. Problem
    - New accounts have no `user_players` row created by any DB trigger.
    - The client (PlayersContext.tsx) worked around this by checking, on
      every load, "does this user have zero players? if so, insert one
      default player." That check-then-insert was not atomic: on a fresh
      signup, the client's mount effect and its Supabase auth-state-change
      listener both call this in quick succession, each sees zero rows
      (neither insert has committed yet), and each inserts its own default
      player - 2 or more identical "Player" rows for the same account.
      Repeating signup/delete cycles compounds this further.

  2. Fix
    - Move the check-then-insert into a single Postgres function guarded by
      a per-user advisory transaction lock (`pg_advisory_xact_lock`), so
      concurrent callers for the same user are serialized: the second
      caller only proceeds after the first has committed its insert (or
      not), and always sees the up-to-date row count.
*/

CREATE OR REPLACE FUNCTION public.ensure_default_player(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_birth_year integer;
BEGIN
  IF auth.uid() != p_user_id THEN
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

GRANT EXECUTE ON FUNCTION public.ensure_default_player(uuid) TO authenticated;
