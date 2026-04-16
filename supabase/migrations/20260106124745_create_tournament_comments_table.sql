/*
  # Create Tournament Comments Table

  Creates a table to allow users to add comments to tournaments

  1. New Tables
    - `tournament_comments`
      - `id` (uuid, primary key)
      - `tournament_id` (uuid) - Reference to tournament
      - `user_id` (uuid) - User who wrote the comment
      - `author_name` (text) - Author display name
      - `text` (text) - Comment content
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on tournament_comments
    - Public can read all comments
    - Only authenticated users can create comments
    - Users can only update/delete their own comments
*/

CREATE TABLE IF NOT EXISTS tournament_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  author_name text NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE tournament_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view all tournament comments"
  ON tournament_comments
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can create tournament comments"
  ON tournament_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tournament comments"
  ON tournament_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tournament comments"
  ON tournament_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tournament_comments_tournament_id ON tournament_comments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_comments_user_id ON tournament_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_comments_created_at ON tournament_comments(created_at DESC);