/*
  # Add Game Configuration to Match Results

  1. Changes
    - Add `game_per_set` column (3, 4, or 6) to track the number of games per set
    - Add `super_tiebreak` column (boolean) to track if super tiebreak was enabled
    - Add `no_ad` column (boolean) to track if no-ad scoring was used

  2. Notes
    - Existing records will have NULL values for these columns
    - These columns are optional as they were not previously tracked
*/

-- Add game configuration columns to match_results table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_results' AND column_name = 'game_per_set'
  ) THEN
    ALTER TABLE match_results ADD COLUMN game_per_set INTEGER CHECK (game_per_set IN (3, 4, 6));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_results' AND column_name = 'super_tiebreak'
  ) THEN
    ALTER TABLE match_results ADD COLUMN super_tiebreak BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_results' AND column_name = 'no_ad'
  ) THEN
    ALTER TABLE match_results ADD COLUMN no_ad BOOLEAN DEFAULT false;
  END IF;
END $$;
