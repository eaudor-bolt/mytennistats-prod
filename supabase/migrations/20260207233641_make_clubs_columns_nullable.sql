/*
  # Make clubs columns nullable
  
  1. Changes
    - Remove NOT NULL constraints from ville, terrain_pratique_libelle, pratiques, lat, lng
    - This allows importing clubs with incomplete data
    - Existing data is preserved
  
  2. Reason
    - Import data may not have all fields populated
    - Some clubs may not have coordinates or specific terrain information
    - Flexibility needed for real-world data imports
*/

ALTER TABLE clubs 
  ALTER COLUMN ville DROP NOT NULL,
  ALTER COLUMN terrain_pratique_libelle DROP NOT NULL,
  ALTER COLUMN pratiques DROP NOT NULL,
  ALTER COLUMN lat DROP NOT NULL,
  ALTER COLUMN lng DROP NOT NULL;