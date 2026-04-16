/*
  # Add scoring_history to live_matches table

  1. Changes
    - Add `scoring_history` column to `live_matches` table to store point-by-point logs
    - This allows viewers to see the latest points in the live match page
  
  2. Notes
    - Uses jsonb type for flexible storage of point data
    - Defaults to empty array
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_matches' AND column_name = 'scoring_history'
  ) THEN
    ALTER TABLE live_matches ADD COLUMN scoring_history jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;