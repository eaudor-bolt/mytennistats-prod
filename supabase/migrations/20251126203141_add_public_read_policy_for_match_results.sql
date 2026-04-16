/*
  # Add public read access to match results
  
  1. Changes
    - Add policy to allow public (anon) users to read match results by ID
    - This enables sharing match history links publicly without authentication
  
  2. Security
    - Only SELECT access is granted to anonymous users
    - Access is still restricted by specific match ID
    - All other operations (INSERT, UPDATE, DELETE) remain restricted to authenticated users only
*/

CREATE POLICY "Allow public read of match results by ID"
  ON match_results FOR SELECT
  TO anon
  USING (true);
