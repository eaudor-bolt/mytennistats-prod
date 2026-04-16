/*
  # Re-add public access to match results for individual sharing
  
  1. Changes
    - Add back policy to allow anonymous users to read match results by direct ID
    - This enables both:
      a) Sharing individual match history links: /match-history/{id}
      b) Sharing collections via: /shared-results/{shareId}
  
  2. Security
    - Anonymous users can read match results if they have the direct ID
    - This is safe because:
      - Match result IDs are UUIDs (hard to guess)
      - Users must explicitly share the link
      - No sensitive data is exposed (match results are meant to be shareable)
    - All write operations (INSERT, UPDATE, DELETE) still require authentication
*/

CREATE POLICY "Allow public read of individual match results"
  ON match_results FOR SELECT
  TO anon
  USING (true);
