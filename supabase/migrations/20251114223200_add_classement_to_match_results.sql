/*
  # Add classement field to match_results table
  
  1. Changes
    - Add `classement` column to match_results table
    - Values: 'NC', '40', '30', '15'
    - Default value: 'NC'
  
  2. Notes
    - This field tracks the ranking level of the match
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_results' AND column_name = 'classement'
  ) THEN
    ALTER TABLE match_results ADD COLUMN classement text DEFAULT 'NC';
  END IF;
END $$;
