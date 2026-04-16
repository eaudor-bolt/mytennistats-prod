/*
  # Auto-cleanup expired live matches

  This migration sets up automatic deletion of live_matches records after 24 hours.
  
  1. Changes
    - Enable pg_cron extension for scheduled jobs
    - Create a cron job that runs every hour to delete expired live matches
    - The job removes all records where expires_at < now()
  
  2. Schedule
    - Runs every hour at minute 0 (0 * * * *)
    - Deletes records older than 24 hours based on expires_at column
  
  3. Notes
    - pg_cron jobs run in the database automatically
    - No manual intervention needed
    - Keeps the live_matches table clean
*/

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to delete expired live matches every hour
SELECT cron.schedule(
  'delete-expired-live-matches',
  '0 * * * *',
  $$DELETE FROM live_matches WHERE expires_at < now()$$
);
