/*
  # Remove unique constraint from club_id
  
  1. Changes
    - Drop unique constraint on club_id column
    - Keep club_id as a regular indexed column (not unique)
    - Allow multiple rows with the same club_id (for multiple installations)
  
  2. Reason
    - Clubs can have multiple physical installations
    - Each installation should be a separate row
    - All installations share the same club_id for grouping
    - The id (UUID) column remains the true primary key
*/

-- Drop unique constraint on club_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'clubs_club_id_key'
  ) THEN
    ALTER TABLE clubs DROP CONSTRAINT clubs_club_id_key;
  END IF;
END $$;

-- Keep the index for performance but without uniqueness
DROP INDEX IF EXISTS idx_clubs_club_id;
CREATE INDEX IF NOT EXISTS idx_clubs_club_id ON clubs(club_id);