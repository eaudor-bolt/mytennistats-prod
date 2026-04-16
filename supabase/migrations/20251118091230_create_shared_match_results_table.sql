/*
  # Create Shared Match Results Table

  1. New Tables
    - `shared_match_results`
      - `id` (uuid, primary key) - Unique identifier for the shared link
      - `user_id` (uuid, foreign key) - User who created the share
      - `player_names` (text[], array) - List of player names included in the share
      - `match_results_ids` (uuid[], array) - List of match result IDs to display
      - `created_at` (timestamptz) - When the share was created
      - `expires_at` (timestamptz, nullable) - Optional expiration date
      - `is_active` (boolean) - Whether the share is still active

  2. Security
    - Enable RLS on `shared_match_results` table
    - Add policy for authenticated users to create their own shares
    - Add policy for public access to read active shares
*/

CREATE TABLE IF NOT EXISTS shared_match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  player_names text[] NOT NULL,
  match_results_ids uuid[] NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,
  is_active boolean DEFAULT true NOT NULL
);

ALTER TABLE shared_match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own shares"
  ON shared_match_results
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own shares"
  ON shared_match_results
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view active shares"
  ON shared_match_results
  FOR SELECT
  TO anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE INDEX IF NOT EXISTS idx_shared_match_results_user_id ON shared_match_results(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_match_results_is_active ON shared_match_results(is_active);
