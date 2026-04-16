/*
  # Add Performance Indexes for Videos

  1. Indexes Added
    - `videos` table:
      - Index on `user_id` for fast user filtering
      - Composite index on `user_id, taken_at DESC` for fast ordered queries
    - `video_tags` table:
      - Index on `video_id` for fast tag lookups
  
  2. Purpose
    - Dramatically improve query performance when loading videos
    - Enable efficient pagination
    - Optimize tag loading
*/

-- Add index on user_id for videos table
CREATE INDEX IF NOT EXISTS idx_videos_user_id 
ON videos(user_id);

-- Add composite index for user_id and taken_at for efficient ordered queries
CREATE INDEX IF NOT EXISTS idx_videos_user_taken_at 
ON videos(user_id, taken_at DESC);

-- Add index on video_id for video_tags table
CREATE INDEX IF NOT EXISTS idx_video_tags_video_id 
ON video_tags(video_id);
