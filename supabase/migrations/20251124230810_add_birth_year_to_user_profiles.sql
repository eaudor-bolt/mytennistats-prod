/*
  # Add birth year to user profiles

  1. Changes
    - Add birth_year column to user_profiles table
    - Allow users to store their birth year (optional field)

  2. Notes
    - Birth year is stored as integer (e.g., 1990, 1985, etc.)
    - Field is nullable to support existing users
*/

-- Add birth_year column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'birth_year'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN birth_year integer;
  END IF;
END $$;
