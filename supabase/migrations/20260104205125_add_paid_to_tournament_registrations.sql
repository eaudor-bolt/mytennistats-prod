/*
  # Add paid column to tournament_registrations

  ## Changes
  - Add `paid` column to track payment status of tournament registrations
    - `paid` (boolean, default false)
  
  ## Purpose
  This enables a three-state registration system:
  1. Not registered
  2. Registered (paid = false) - Shows 1 tick
  3. Registered and paid (paid = true) - Shows 2 ticks
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_registrations' AND column_name = 'paid'
  ) THEN
    ALTER TABLE tournament_registrations ADD COLUMN paid boolean DEFAULT false NOT NULL;
  END IF;
END $$;

CREATE POLICY "Users can update own registrations paid status"
  ON tournament_registrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
