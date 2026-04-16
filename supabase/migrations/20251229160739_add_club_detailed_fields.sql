/*
  # Add detailed club information fields

  1. Changes
    - Add `address` field to store club address
    - Add `website` field to store club website URL
    - Add `total_courts` field for total number of tennis courts
    - Add `indoor_courts` field for number of covered/indoor courts
    - Add `padel_courts` field for number of padel courts
    - Add `pickle_courts` field for number of pickleball courts
    
  2. Notes
    - All new fields are optional and default to NULL
    - Court numbers default to 0 where applicable
    - These fields will be populated from terrainPratiqueLibelle parsing
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'address'
  ) THEN
    ALTER TABLE clubs ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'website'
  ) THEN
    ALTER TABLE clubs ADD COLUMN website text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'total_courts'
  ) THEN
    ALTER TABLE clubs ADD COLUMN total_courts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'indoor_courts'
  ) THEN
    ALTER TABLE clubs ADD COLUMN indoor_courts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'padel_courts'
  ) THEN
    ALTER TABLE clubs ADD COLUMN padel_courts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'pickle_courts'
  ) THEN
    ALTER TABLE clubs ADD COLUMN pickle_courts integer DEFAULT 0;
  END IF;
END $$;