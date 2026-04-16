/*
  # Update user_players table schema

  1. Changes
    - Add first_name column (replacing name with proper first/last split)
    - Add last_name column  
    - Add license_number column for FFT license
    - Rename year_of_birth to birth_year for consistency
    - Migrate existing data from name to first_name
  
  2. Security
    - No changes to RLS policies (already restricted to authenticated users)
*/

-- Add new columns
ALTER TABLE user_players 
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS birth_year integer;

-- Migrate existing data from name to first_name
UPDATE user_players 
SET first_name = name 
WHERE first_name IS NULL AND name IS NOT NULL;

-- Set default values for last_name if null
UPDATE user_players 
SET last_name = '' 
WHERE last_name IS NULL;

-- Migrate year_of_birth to birth_year
UPDATE user_players 
SET birth_year = year_of_birth 
WHERE birth_year IS NULL AND year_of_birth IS NOT NULL;

-- Make first_name required
ALTER TABLE user_players 
  ALTER COLUMN first_name SET NOT NULL;

-- Drop old name column (after migration)
ALTER TABLE user_players 
  DROP COLUMN IF EXISTS name;

-- Drop old year_of_birth column (after migration)
ALTER TABLE user_players 
  DROP COLUMN IF EXISTS year_of_birth;
