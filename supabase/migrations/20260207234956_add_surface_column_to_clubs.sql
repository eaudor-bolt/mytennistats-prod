/*
  # Add surface column to clubs table
  
  1. Changes
    - Add `surface` column to store the primary surface type from installations data
    - This replaces the client-side random surface generation with actual data
  
  2. Notes
    - Surface will be extracted from the installations.surfaces array
    - Common values include: "Béton poreux", "Résine", "Terre battue traditionnelle", etc.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'surface'
  ) THEN
    ALTER TABLE clubs ADD COLUMN surface text;
  END IF;
END $$;
