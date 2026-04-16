/*
  # Fix TMC Event Null Values

  1. Changes
    - Update all null values in tmc_event to false
    - Add NOT NULL constraint to tmc_event column
    - Ensure default value is false

  2. Details
    - This ensures consistent filtering behavior in the frontend
    - All tournaments without TMC designation are explicitly marked as false
*/

UPDATE tournaments SET tmc_event = false WHERE tmc_event IS NULL;

ALTER TABLE tournaments ALTER COLUMN tmc_event SET DEFAULT false;
ALTER TABLE tournaments ALTER COLUMN tmc_event SET NOT NULL;
