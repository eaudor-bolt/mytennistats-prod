/*
  # Create custom_tournament_events table

  ## New Tables
  - `custom_tournament_events`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references auth.users)
    - `player_id` (uuid, references user_players)
    - `event_name` (text) — free-text event name typed by the user
    - `created_at` (timestamptz)

  ## Security
  - Enable RLS
  - Users can only view/manage their own custom events

  ## Purpose
  The "Add Match" form lets a player log a match for an event that isn't in
  their registered tournament list (e.g. a club/friendly event, or a user who
  doesn't use the Tournaments page at all). Previously there was no way to
  persist that custom event name so it would show up again next time. This
  table stores those manually-added event names per player, independent of
  the `tournaments` / `tournament_registrations` catalogue, so the match
  entry form can list both catalogued tournament registrations and these
  custom events together.
*/

CREATE TABLE IF NOT EXISTS custom_tournament_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES user_players(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, player_id, event_name)
);

ALTER TABLE custom_tournament_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom events"
  ON custom_tournament_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom events"
  ON custom_tournament_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom events"
  ON custom_tournament_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_custom_tournament_events_user_id ON custom_tournament_events(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_tournament_events_player_id ON custom_tournament_events(player_id);
