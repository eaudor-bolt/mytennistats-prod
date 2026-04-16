/*
  # Add Public Access Policy for Shared Match Results

  1. Changes
    - Add RLS policy to allow anonymous users to view match results that are included in active shared links
    - This policy checks if the match result ID exists in any active share's match_results_ids array
    - Only active shares (is_active = true and not expired) are considered

  2. Security
    - Anonymous users can ONLY view match results that are explicitly shared via active share links
    - Users still need authentication to create, update, or delete their own match results
    - The policy is restrictive and only grants SELECT access to specific match results
*/

-- Allow anonymous users to view match results that are part of active shares
CREATE POLICY "Public can view shared match results"
  ON match_results
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM shared_match_results
      WHERE shared_match_results.is_active = true
        AND (shared_match_results.expires_at IS NULL OR shared_match_results.expires_at > now())
        AND match_results.id = ANY(shared_match_results.match_results_ids)
    )
  );
