/*
  # Fix delete_user_account Function

  1. Changes
    - Fix parameter shadowing issue in WHERE clauses
    - Remove reference to non-existent stripe_customers table
    - Ensure all user data is properly deleted including match_results
    - Add proper parameter qualification to avoid ambiguity

  2. Tables Cleaned Up
    - shared_match_results
    - live_matches
    - match_results (FIXED: was not being deleted due to parameter shadowing)
    - convocations
    - tournament_registrations
    - user_players
    - user_usage_stats
    - user_feature_flags
    - user_subscriptions
    - user_profiles
    - auth.users

  3. Security
    - Maintains SECURITY DEFINER for proper permissions
    - Verifies user can only delete their own account
*/

DROP FUNCTION IF EXISTS public.delete_user_account(uuid);

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify the caller is deleting their own account
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'You can only delete your own account';
  END IF;

  -- Delete data in reverse order of dependencies
  -- These will be cascade deleted by foreign keys, but explicit deletion ensures cleanup
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

  -- Finally, delete the auth user (this will cascade to any remaining references)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;