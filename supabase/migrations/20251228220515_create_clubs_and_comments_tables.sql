/*
  # Create Clubs and Comments Tables

  1. New Tables
    - `clubs`
      - `id` (uuid, primary key)
      - `club_id` (text) - External club ID
      - `nom` (text) - Club name
      - `ville` (text) - City
      - `terrain_pratique_libelle` (text) - Court description
      - `pratiques` (text[]) - Array of practices
      - `lat` (decimal) - Latitude
      - `lng` (decimal) - Longitude
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `club_comments`
      - `id` (uuid, primary key)
      - `club_id` (text) - Reference to club external ID
      - `user_id` (uuid) - User who wrote the comment
      - `author_name` (text) - Author display name
      - `text` (text) - Comment content
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Public can read clubs data
    - Public can read all comments
    - Only authenticated users can create comments
    - Users can only update/delete their own comments
*/

CREATE TABLE IF NOT EXISTS clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id text UNIQUE NOT NULL,
  nom text NOT NULL,
  ville text NOT NULL,
  terrain_pratique_libelle text NOT NULL,
  pratiques text[] NOT NULL DEFAULT '{}',
  lat decimal NOT NULL,
  lng decimal NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS club_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  author_name text NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_comments ENABLE ROW LEVEL SECURITY;

-- Clubs policies
CREATE POLICY "Public can view all clubs"
  ON clubs
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Club comments policies
CREATE POLICY "Public can view all comments"
  ON club_comments
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON club_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON club_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON club_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clubs_club_id ON clubs(club_id);
CREATE INDEX IF NOT EXISTS idx_clubs_location ON clubs(lat, lng);
CREATE INDEX IF NOT EXISTS idx_club_comments_club_id ON club_comments(club_id);
CREATE INDEX IF NOT EXISTS idx_club_comments_user_id ON club_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_club_comments_created_at ON club_comments(created_at DESC);
