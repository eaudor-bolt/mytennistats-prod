/*
  # Restrict club comments to their own author

  ## Changes
  - Replaces the `club_comments` SELECT policy "Public can view all comments"
    (which used `USING (true)` and was granted to both `anon` and
    `authenticated`, letting anyone - including logged-out visitors - read
    every user's comments on every club) with a new policy that only lets an
    authenticated user read their own comments (`auth.uid() = user_id`).

  ## Purpose
  Club comments are meant to be personal notes per user/account, not a public
  community board. INSERT/UPDATE/DELETE were already correctly scoped to
  `auth.uid() = user_id`; only the SELECT policy needed tightening.
*/

DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view all comments" ON club_comments;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'club_comments' AND policyname = 'Users can view their own comments'
  ) THEN
    CREATE POLICY "Users can view their own comments"
      ON club_comments
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
