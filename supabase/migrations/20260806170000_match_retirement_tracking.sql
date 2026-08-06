/*
  # Track retirement/abandon for early-terminated matches

  1. Problem
    - "Terminer le Match" ends a match regardless of whether either player
      has actually won it. Ending early is, in tennis terms, a retirement -
      but nothing recorded WHO retired, so there was no way to know who
      actually won an early-terminated match, and (per the previous
      migration) `live_matches.is_finished` never even got set to true for
      this path, which is also why re-opening Live Score afterward could
      incorrectly offer to "resume" an already-ended match.

  2. Fix
    - `retirement_player` on both tables: 'adversaire' | 'famille' | null.
      Null means a normal finish (all sets played out) or a match still in
      progress. Set means that player retired - the other player won.
    - No CHECK constraint on the two values: matches every other free-text
      player-side column on these tables (current_server, etc.), and keeps
      this a plain data column the client fully owns.
*/

ALTER TABLE live_matches
  ADD COLUMN IF NOT EXISTS retirement_player text;

ALTER TABLE match_results
  ADD COLUMN IF NOT EXISTS retirement_player text;
