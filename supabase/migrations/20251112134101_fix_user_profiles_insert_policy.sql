/*
  # Fix user profiles INSERT policy

  1. Changes
    - Drop existing INSERT policy
    - Add new INSERT policy that allows authenticated users to insert their own profile
    - Ensures users can only create a profile for themselves (id matches auth.uid())
*/

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);