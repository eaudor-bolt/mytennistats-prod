/*
  # Add sport-specific court columns

  1. New Columns on `clubs`
    - `tennis_courts` (integer) - number of tennis courts
    - `indoor_tennis_courts` (integer) - number of indoor tennis courts
    - `indoor_padel_courts` (integer) - number of indoor padel courts
    - `indoor_pickle_courts` (integer) - number of indoor pickleball courts

  2. Changes
    - `total_courts` will now represent the sum of all court types (tennis + padel + pickle)
    - `indoor_courts` will now represent the sum of all indoor court types
    - Existing `padel_courts` and `pickle_courts` columns are kept as-is

  3. Notes
    - The import function uses the `pratique` field from surfaces JSON to classify courts by sport
    - Surfaces with pratique = TENNIS go to tennis_courts / indoor_tennis_courts
    - Surfaces with pratique = PADEL go to padel_courts / indoor_padel_courts
    - Surfaces with pratique = PICKLEBALL go to pickle_courts / indoor_pickle_courts
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'tennis_courts'
  ) THEN
    ALTER TABLE clubs ADD COLUMN tennis_courts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'indoor_tennis_courts'
  ) THEN
    ALTER TABLE clubs ADD COLUMN indoor_tennis_courts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'indoor_padel_courts'
  ) THEN
    ALTER TABLE clubs ADD COLUMN indoor_padel_courts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'indoor_pickle_courts'
  ) THEN
    ALTER TABLE clubs ADD COLUMN indoor_pickle_courts integer DEFAULT 0;
  END IF;
END $$;
