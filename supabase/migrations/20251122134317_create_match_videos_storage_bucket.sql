/*
  # Create Match Videos Storage Bucket

  1. Storage Setup
    - Create a public storage bucket called `match-videos` for storing point-by-point match videos
    - Set up public access policies so videos can be viewed by anyone with the share link
    
  2. Security
    - Allow authenticated users to upload videos to their own match folders
    - Allow public read access to all videos for sharing functionality
    - Videos are organized by live match ID: `{live_match_id}/point-{sequence}-{timestamp}.webm`
*/

-- Create the storage bucket for match videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('match-videos', 'match-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload videos to their match folders
CREATE POLICY "Users can upload videos to their matches"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'match-videos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM live_matches WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to delete their own videos
CREATE POLICY "Users can delete their own match videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'match-videos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM live_matches WHERE user_id = auth.uid()
  )
);

-- Allow public read access to all videos for sharing
CREATE POLICY "Public can view match videos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'match-videos');