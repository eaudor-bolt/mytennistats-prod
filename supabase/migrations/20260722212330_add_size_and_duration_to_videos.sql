/*
  # Add size and duration tracking to videos

  ## Changes
  - `videos.size_bytes` (bigint, nullable) — file size of the uploaded video, in bytes
  - `videos.duration_seconds` (numeric, nullable) — playback duration of the video, in seconds

  ## Purpose
  Needed to compute a per-user video storage usage summary (shown in Settings).
  Both columns are nullable and left unpopulated for existing rows — only new
  uploads (from the Videos page and from favorited Live Score point clips) are
  expected to populate them going forward.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'size_bytes'
  ) THEN
    ALTER TABLE videos ADD COLUMN size_bytes bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE videos ADD COLUMN duration_seconds numeric;
  END IF;
END $$;
