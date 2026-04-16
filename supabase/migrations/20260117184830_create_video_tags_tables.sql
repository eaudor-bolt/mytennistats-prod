/*
  # Create Video Tags System

  1. New Tables
    - `tags`
      - `id` (uuid, primary key)
      - `name` (text, unique, required) - Tag name (e.g., "training", "match", "backhand")
      - `created_at` (timestamptz)

    - `video_tags`
      - `id` (uuid, primary key)
      - `video_id` (uuid, references videos)
      - `tag_id` (uuid, references tags)
      - `created_at` (timestamptz)
      - Unique constraint on (video_id, tag_id)

  2. Security
    - Enable RLS on both tables
    - Tags table: Anyone authenticated can read, insert if not exists
    - Video_tags table: Users can manage tags for their own videos

  3. Indexes
    - Index on video_tags(video_id) for fast video tag lookups
    - Index on video_tags(tag_id) for fast tag filtering
*/

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create video_tags junction table
CREATE TABLE IF NOT EXISTS video_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(video_id, tag_id)
);

-- Enable RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_tags ENABLE ROW LEVEL SECURITY;

-- Tags policies: Anyone authenticated can read tags
CREATE POLICY "Anyone can view tags"
  ON tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Video_tags policies: Users can manage tags for their own videos
CREATE POLICY "Users can view video tags for their videos"
  ON video_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = video_tags.video_id
      AND videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tags for their videos"
  ON video_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = video_tags.video_id
      AND videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tags from their videos"
  ON video_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = video_tags.video_id
      AND videos.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_video_tags_video_id ON video_tags(video_id);
CREATE INDEX IF NOT EXISTS idx_video_tags_tag_id ON video_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
