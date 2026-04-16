/*
  # Create live_matches table for public live score sharing

  1. New Tables
    - `live_matches`
      - `id` (uuid, primary key) - Unique match identifier for sharing
      - `user_id` (uuid) - Match owner
      - `player_name` (text) - Player name
      - `game_score` (jsonb) - Current game score
      - `set_scores` (jsonb) - Set scores array
      - `current_set` (integer) - Current set number
      - `is_tiebreak` (boolean) - Whether in tiebreak
      - `is_finished` (boolean) - Whether match is finished
      - `current_server` (text) - Who is serving
      - `game_format` (jsonb) - Match format settings
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `expires_at` (timestamptz) - Auto-expire after 24 hours

  2. Security
    - Enable RLS on `live_matches` table
    - Authenticated users can create/update/delete their own matches
    - Anyone can view matches (for public sharing)
*/

CREATE TABLE IF NOT EXISTS live_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name text NOT NULL DEFAULT 'Player',
  game_score jsonb NOT NULL DEFAULT '{"adversaire": 0, "famille": 0}'::jsonb,
  set_scores jsonb NOT NULL DEFAULT '{"adversaire": [0, 0, 0], "famille": [0, 0, 0]}'::jsonb,
  current_set integer NOT NULL DEFAULT 0,
  is_tiebreak boolean NOT NULL DEFAULT false,
  is_finished boolean NOT NULL DEFAULT false,
  current_server text NOT NULL DEFAULT 'famille',
  game_format jsonb NOT NULL DEFAULT '{"threeGames": false, "fourGames": false, "supertiebreak": true, "noAd": false}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '24 hours'
);

ALTER TABLE live_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live matches"
  ON live_matches FOR SELECT
  USING (true);

CREATE POLICY "Users can create own live matches"
  ON live_matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own live matches"
  ON live_matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own live matches"
  ON live_matches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_live_matches_user_id ON live_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_live_matches_expires_at ON live_matches(expires_at);