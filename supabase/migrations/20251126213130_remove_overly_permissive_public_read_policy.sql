/*
  # Remove overly permissive public read policy
  
  1. Changes
    - Drop the "Allow public read of match results by ID" policy which allows ANY anonymous user to read ALL match results
    - Keep only the more restrictive "Public can view shared match results" policy which requires explicit sharing
  
  2. Security
    - Ensures anonymous users can ONLY access match results that are explicitly shared via active share links
    - Maintains proper security boundaries for user data
*/

DROP POLICY IF EXISTS "Allow public read of match results by ID" ON match_results;
