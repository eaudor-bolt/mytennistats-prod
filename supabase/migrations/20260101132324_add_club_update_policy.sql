/*
  # Add UPDATE policy for clubs table

  1. Changes
    - Add policy to allow authenticated users to update clubs
    - Required for upsert operations during club imports

  2. Security
    - Only authenticated users can update clubs
    - Allows the import function to work correctly with upsert
*/

-- Drop the policy if it exists first
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clubs' AND policyname = 'Allow update of clubs'
  ) THEN
    DROP POLICY "Allow update of clubs" ON clubs;
  END IF;
END $$;

-- Add UPDATE policy for clubs
CREATE POLICY "Allow update of clubs"
  ON clubs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
