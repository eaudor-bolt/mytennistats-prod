/*
  # Add TMC Event Field to Tournaments

  1. Changes
    - Add `tmc_event` boolean field to tournaments table
    - Defaults to false for existing tournaments
    - Index added for performance when filtering

  2. Details
    - This field allows filtering tournaments that are TMC (Tennis Masters Cup) events
    - Users can toggle this filter in the UI to see only TMC or non-TMC events
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'tmc_event'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN tmc_event boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tournaments_tmc_event ON tournaments(tmc_event);
