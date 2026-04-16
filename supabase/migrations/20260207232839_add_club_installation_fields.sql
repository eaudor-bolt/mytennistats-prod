/*
  # Add club installation fields
  
  1. Changes
    - Add last_modified column for tracking data updates
    - Add total_adults column for member count
    - Add total_kids column for junior member count
    - Add equipes column for team information (JSONB array)
    - Add installations column for installation details (JSONB)
    - Add telephone column for contact
    - Add email column for contact
    - Add indexes for performance
  
  2. Notes
    - Multiple installations of the same club will be stored as separate rows
    - All rows for the same club will share the same club_id
    - Each row represents one physical installation location
*/

-- Add columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'last_modified'
  ) THEN
    ALTER TABLE clubs ADD COLUMN last_modified timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'total_adults'
  ) THEN
    ALTER TABLE clubs ADD COLUMN total_adults integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'total_kids'
  ) THEN
    ALTER TABLE clubs ADD COLUMN total_kids integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'equipes'
  ) THEN
    ALTER TABLE clubs ADD COLUMN equipes jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'installations'
  ) THEN
    ALTER TABLE clubs ADD COLUMN installations jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'telephone'
  ) THEN
    ALTER TABLE clubs ADD COLUMN telephone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'email'
  ) THEN
    ALTER TABLE clubs ADD COLUMN email text;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clubs_club_id ON clubs(club_id);
CREATE INDEX IF NOT EXISTS idx_clubs_last_modified ON clubs(last_modified);