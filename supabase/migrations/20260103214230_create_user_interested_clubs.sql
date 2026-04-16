/*
  # Create User Interested Clubs Table

  1. New Tables
    - `user_interested_clubs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `club_id` (text, the club identifier)
      - `created_at` (timestamp)
      - Unique constraint on (user_id, club_id)
  
  2. Security
    - Enable RLS on `user_interested_clubs` table
    - Add policy for authenticated users to read their own interested clubs
    - Add policy for authenticated users to insert their own interested clubs
    - Add policy for authenticated users to delete their own interested clubs
*/

CREATE TABLE IF NOT EXISTS user_interested_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  club_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, club_id)
);

ALTER TABLE user_interested_clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own interested clubs"
  ON user_interested_clubs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interested clubs"
  ON user_interested_clubs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own interested clubs"
  ON user_interested_clubs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);