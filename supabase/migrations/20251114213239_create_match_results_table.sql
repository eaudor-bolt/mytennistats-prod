/*
  # Create match results table
  
  1. New Tables
    - `match_results`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `date` (date)
      - `player_name` (text)
      - `tournament_name` (text)
      - `score` (text)
      - `impressions` (jsonb) - stores forehand, backhand, serve, return
      - `scoring_history` (jsonb) - stores detailed match statistics
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `match_results` table
    - Add policies for users to manage their own match results
*/

CREATE TABLE IF NOT EXISTS match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  player_name text NOT NULL,
  tournament_name text NOT NULL,
  score text NOT NULL,
  impressions jsonb DEFAULT '{"forehand": "good", "backhand": "good", "serve": "good", "return": "good"}'::jsonb,
  scoring_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own match results"
  ON match_results FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own match results"
  ON match_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own match results"
  ON match_results FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own match results"
  ON match_results FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_match_results_user_date ON match_results(user_id, date DESC);
