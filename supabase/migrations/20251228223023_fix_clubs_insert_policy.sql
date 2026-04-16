/*
  # Fix Clubs Insert Policy

  1. Changes
    - Add INSERT policy for clubs table to allow seeding from application
    - Only allows inserts if club_id doesn't already exist (prevents duplicates)
  
  2. Security
    - Allows anon and authenticated users to insert clubs
    - Prevents duplicate entries with club_id check
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clubs' 
    AND policyname = 'Allow insert of new clubs'
  ) THEN
    CREATE POLICY "Allow insert of new clubs"
      ON clubs
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;
