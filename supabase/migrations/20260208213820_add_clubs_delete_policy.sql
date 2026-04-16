/*
  # Add DELETE policy for clubs table

  1. Security Changes
    - Add DELETE policy on `clubs` table for authenticated users
    - This allows the club import process to remove old entries before upserting

  2. Important Notes
    - Without this policy, DELETE operations were silently failing due to RLS
    - This was the root cause of duplicate club entries accumulating
*/

CREATE POLICY "Authenticated users can delete clubs"
  ON clubs
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
