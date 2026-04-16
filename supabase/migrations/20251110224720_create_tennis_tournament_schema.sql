/*
  # Tennis Tournament Organizer Schema

  1. New Tables
    - `tournaments`
      - `id` (uuid, primary key)
      - `name` (text) - Tournament name
      - `description` (text) - Tournament description
      - `location` (text) - Location name
      - `latitude` (decimal) - Map latitude
      - `longitude` (decimal) - Map longitude
      - `start_date` (date) - Tournament start date
      - `end_date` (date) - Tournament end date
      - `status` (text) - Tournament status (upcoming, ongoing, completed)
      - `max_participants` (integer) - Maximum number of participants
      - `created_at` (timestamptz)
    
    - `players`
      - `id` (uuid, primary key)
      - `name` (text) - Player name
      - `email` (text) - Player email
      - `ranking` (integer) - Player ranking
      - `created_at` (timestamptz)
    
    - `matches`
      - `id` (uuid, primary key)
      - `tournament_id` (uuid, foreign key)
      - `player1_id` (uuid, foreign key)
      - `player2_id` (uuid, foreign key)
      - `player1_score` (text) - Score for player 1
      - `player2_score` (text) - Score for player 2
      - `winner_id` (uuid, foreign key)
      - `match_date` (timestamptz)
      - `round` (text) - Match round (round of 16, quarter-final, etc.)
      - `status` (text) - Match status (scheduled, in_progress, completed)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for public read access (suitable for a tournament app)
*/

CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  location text NOT NULL,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
  max_participants integer DEFAULT 32,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  ranking integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  player1_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  player2_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  player1_score text DEFAULT '',
  player2_score text DEFAULT '',
  winner_id uuid REFERENCES players(id) ON DELETE SET NULL,
  match_date timestamptz NOT NULL,
  round text NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournaments"
  ON tournaments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view players"
  ON players FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view matches"
  ON matches FOR SELECT
  USING (true);