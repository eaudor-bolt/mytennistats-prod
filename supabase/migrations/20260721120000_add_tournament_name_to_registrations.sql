/*
  # Add tournament_name to tournament_registrations

  ## Changes
  - Add `tournament_name` column to `tournament_registrations` (text, nullable)
    - Stores a free-text event name for registrations that don't correspond
      to a catalogued row in `tournaments` (e.g. a club/friendly event a
      player typed manually when logging a match result).
  - Drop the `NOT NULL` constraint on `tournament_id` so a registration can
    reference either a real tournament, a custom name, or both.
  - Add a check constraint requiring at least one of `tournament_id` /
    `tournament_name` to be set, so a registration always identifies an event.

  ## Purpose
  The "Add Match" form lets a player log a match for an event that isn't in
  their registered tournament list. Previously there was no way to persist
  that custom event name so it would show up again next time. This lets the
  app insert a `tournament_registrations` row with `tournament_id = null` and
  `tournament_name` set to the typed value, so it appears in future match
  entry for that player without needing a full `tournaments` catalogue entry.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_registrations' AND column_name = 'tournament_name'
  ) THEN
    ALTER TABLE tournament_registrations ADD COLUMN tournament_name text;
  END IF;
END $$;

ALTER TABLE tournament_registrations ALTER COLUMN tournament_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tournament_registrations'
      AND constraint_name = 'tournament_registrations_has_event_check'
  ) THEN
    ALTER TABLE tournament_registrations
      ADD CONSTRAINT tournament_registrations_has_event_check
      CHECK (tournament_id IS NOT NULL OR tournament_name IS NOT NULL);
  END IF;
END $$;
