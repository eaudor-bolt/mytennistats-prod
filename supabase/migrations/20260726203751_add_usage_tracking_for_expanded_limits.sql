/*
  # Add usage-tracking columns for expanded free/premium limits

  ## Changes
  - `user_usage_stats.live_points_recorded` (integer, default 0) — points recorded
    during Live Score sessions (free cap: 3, premium: unlimited)
  - `user_usage_stats.videos_uploaded` (integer, default 0) — videos uploaded via
    the Video Library, including favorited Live Score point clips (free cap: 3,
    premium: unlimited)
  - `user_usage_stats.video_storage_bytes` (bigint, default 0) — running total of
    uploaded video bytes, used to enforce the premium 1GB storage cap
  - `user_usage_stats.rules_chat_responses` (integer, default 0) — AI rules-chat
    responses received (free cap: 3, premium: unlimited)

  ## Purpose
  Supports the updated free/premium pricing tiers:
  - Free: 1 player profile, 3 match results, 3 match-result shares, 1 live-score
    share, 3 live-score point recordings, 3 video uploads (max 1 min each),
    3 rules-chat responses.
  - Premium: unlimited everything except a 1GB total video storage cap and the
    same 1-minute-per-video duration limit.

  All new columns default to 0 so existing rows (and any row inserted by the
  `initialize_new_user()` trigger without explicitly naming these columns) are
  unaffected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_usage_stats' AND column_name = 'live_points_recorded'
  ) THEN
    ALTER TABLE user_usage_stats ADD COLUMN live_points_recorded integer DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_usage_stats' AND column_name = 'videos_uploaded'
  ) THEN
    ALTER TABLE user_usage_stats ADD COLUMN videos_uploaded integer DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_usage_stats' AND column_name = 'video_storage_bytes'
  ) THEN
    ALTER TABLE user_usage_stats ADD COLUMN video_storage_bytes bigint DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_usage_stats' AND column_name = 'rules_chat_responses'
  ) THEN
    ALTER TABLE user_usage_stats ADD COLUMN rules_chat_responses integer DEFAULT 0 NOT NULL;
  END IF;
END $$;
