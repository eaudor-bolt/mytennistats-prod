/*
  # Add location, phone, and judge fields to convocations

  1. Changes
    - Add `location` column to store venue address
    - Add `phone` column to store contact phone number
    - Add `judge_arbitrator` column to store judge/arbitrator name
  
  2. Notes
    - All fields are optional (can be NULL or empty string)
    - These fields will be included in Google Calendar links
    - Improves convocation information completeness
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'convocations' AND column_name = 'location'
  ) THEN
    ALTER TABLE convocations ADD COLUMN location text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'convocations' AND column_name = 'phone'
  ) THEN
    ALTER TABLE convocations ADD COLUMN phone text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'convocations' AND column_name = 'judge_arbitrator'
  ) THEN
    ALTER TABLE convocations ADD COLUMN judge_arbitrator text DEFAULT '';
  END IF;
END $$;
