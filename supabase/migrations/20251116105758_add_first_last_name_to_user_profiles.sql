/*
  # Add first and last name to user profiles

  1. Changes
    - Add `first_name` column to store user's first name
    - Add `last_name` column to store user's last name
  
  2. Notes
    - These fields will be collected during registration
    - Can be edited in settings page
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN first_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_name text;
  END IF;
END $$;