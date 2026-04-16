/*
  # Add user_id to videos table and setup RLS policies

  1. Changes
    - Add user_id column to videos table
    - Create proper RLS policies for videos
    - Create storage bucket and policies for recorded-videos

  2. Security
    - Enable RLS on videos table
    - Only authenticated users can manage their own videos
    - Public can view all videos (for sharing)
*/

-- Add user_id column to videos table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE videos ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can insert their own videos" ON videos;
  DROP POLICY IF EXISTS "Users can view their own videos" ON videos;
  DROP POLICY IF EXISTS "Users can delete their own videos" ON videos;
EXCEPTION WHEN undefined_object THEN
  -- Policy doesn't exist, ignore error
  NULL;
END $$;

-- Create new policies
CREATE POLICY "Users can insert their own videos"
ON videos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own videos"
ON videos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos"
ON videos
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create the storage bucket for recorded videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('recorded-videos', 'recorded-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view their own videos in storage" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own videos from storage" ON storage.objects;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- Allow authenticated users to upload videos
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recorded-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view their own videos
CREATE POLICY "Users can view their own videos in storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'recorded-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access for shared videos
CREATE POLICY "Public can view videos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'recorded-videos');

-- Allow authenticated users to delete their own videos
CREATE POLICY "Users can delete their own videos from storage"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'recorded-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);