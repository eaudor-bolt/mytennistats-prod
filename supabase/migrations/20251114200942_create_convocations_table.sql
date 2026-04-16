/*
  # Create convocations table

  1. New Tables
    - `convocations`
      - `id` (uuid, primary key)
      - `tournament_id` (uuid, foreign key to tournaments)
      - `player_name` (text) - Name of the player (Ida, Ruben, Papa)
      - `event_code` (text) - Tournament event code
      - `convocation_date` (date) - Date of the convocation
      - `convocation_time` (time) - Time of the convocation (HH:MM)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `convocations` table
    - Add policies for authenticated users to manage convocations
*/

CREATE TABLE IF NOT EXISTS convocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  player_name text NOT NULL CHECK (player_name IN ('Ida', 'Ruben', 'Papa')),
  event_code text NOT NULL,
  convocation_date date NOT NULL,
  convocation_time time NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE convocations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view convocations"
  ON convocations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert convocations"
  ON convocations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update convocations"
  ON convocations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete convocations"
  ON convocations FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS convocations_tournament_id_idx ON convocations(tournament_id);
CREATE INDEX IF NOT EXISTS convocations_event_code_idx ON convocations(event_code);
CREATE INDEX IF NOT EXISTS convocations_player_name_idx ON convocations(player_name);
CREATE INDEX IF NOT EXISTS convocations_date_idx ON convocations(convocation_date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_convocations_updated_at BEFORE UPDATE ON convocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
