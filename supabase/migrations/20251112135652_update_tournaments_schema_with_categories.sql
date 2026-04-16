/*
  # Update tournaments schema to match JSON data structure

  1. Changes
    - Drop existing tournaments table and recreate with proper structure
    - Add all fields from JSON including categories as JSONB
    - Add proper indexes for performance
    - Keep existing RLS policies
  
  2. New Fields
    - organizer (text)
    - title (text) - main name
    - judge_arbitrator (text)
    - surface (text)
    - cash_prize (numeric)
    - prizes_lots (numeric)
    - online_registration (boolean)
    - online_payment (boolean)
    - event_code (text)
    - contact_email (text)
    - venue_name (text)
    - venue_address (text)
    - venue_city (text)
    - venue_postal_code (text)
    - venue_phone (text)
    - latitude (numeric)
    - longitude (numeric)
    - categories (jsonb) - array of category objects
    - date_ouverture_inscription (date)
*/

DROP TABLE IF EXISTS tournaments CASCADE;

CREATE TABLE tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  judge_arbitrator text,
  surface text,
  cash_prize numeric DEFAULT 0,
  prizes_lots numeric DEFAULT 0,
  online_registration boolean DEFAULT false,
  online_payment boolean DEFAULT false,
  event_code text UNIQUE,
  contact_email text,
  venue_name text,
  venue_address text,
  venue_city text,
  venue_postal_code text,
  venue_phone text,
  latitude numeric,
  longitude numeric,
  categories jsonb DEFAULT '[]'::jsonb,
  date_ouverture_inscription date,
  status text DEFAULT 'upcoming',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tournaments_start_date ON tournaments(start_date);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_event_code ON tournaments(event_code);
CREATE INDEX idx_tournaments_location ON tournaments(latitude, longitude);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tournaments"
  ON tournaments FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert tournaments"
  ON tournaments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tournaments"
  ON tournaments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tournaments"
  ON tournaments FOR DELETE
  TO authenticated
  USING (true);
