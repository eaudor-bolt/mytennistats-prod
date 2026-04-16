/*
  # Add user_id to convocations table

  1. Changes
    - Add `user_id` column to `convocations` table
    - Update RLS policies to filter by user_id

  2. Security
    - Users can only see their own convocations
    - Users can only create/update/delete their own convocations
*/

-- Add user_id column (nullable initially)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'convocations' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE convocations ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view all convocations" ON convocations;
  DROP POLICY IF EXISTS "Users can view own convocations" ON convocations;
  DROP POLICY IF EXISTS "Users can insert convocations" ON convocations;
  DROP POLICY IF EXISTS "Users can insert own convocations" ON convocations;
  DROP POLICY IF EXISTS "Users can update convocations" ON convocations;
  DROP POLICY IF EXISTS "Users can update own convocations" ON convocations;
  DROP POLICY IF EXISTS "Users can delete convocations" ON convocations;
  DROP POLICY IF EXISTS "Users can delete own convocations" ON convocations;
END $$;

-- Create new policies with user_id check
CREATE POLICY "Users can view own convocations"
  ON convocations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own convocations"
  ON convocations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own convocations"
  ON convocations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own convocations"
  ON convocations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);