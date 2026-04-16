/*
  # Add event details and comments to match_results

  1. Changes
    - Add `event_details` column to store combined evenement_dropdown + '-' + input_text
    - Add `comments` column to store additional comments about the match
  
  2. Notes
    - Both fields are optional (can be NULL)
    - event_details stores the combined tournament event information
    - comments stores user notes about the match
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_results' AND column_name = 'event_details'
  ) THEN
    ALTER TABLE match_results ADD COLUMN event_details text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_results' AND column_name = 'comments'
  ) THEN
    ALTER TABLE match_results ADD COLUMN comments text DEFAULT '';
  END IF;
END $$;
