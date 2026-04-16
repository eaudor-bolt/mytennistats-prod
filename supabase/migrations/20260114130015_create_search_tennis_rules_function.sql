/*
  # Create vector similarity search function

  1. New Functions
    - `search_tennis_rules` - Performs vector similarity search on tennis rules chunks
      - Parameters:
        - query_embedding (vector(1024)) - The embedding of the user's question
        - match_threshold (float) - Minimum similarity score (0-1)
        - match_count (int) - Maximum number of results to return
        - doc_language (text) - Language filter ('en' or 'fr')
      - Returns: Chunks ordered by similarity with their content and metadata

  2. Notes
    - Uses cosine similarity for vector comparison
    - Filters by document language
    - Returns most relevant chunks first
*/

CREATE OR REPLACE FUNCTION search_tennis_rules(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  doc_language text DEFAULT 'en'
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index integer,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM tennis_rules_chunks c
  JOIN tennis_rules_documents d ON c.document_id = d.id
  WHERE 
    d.language = doc_language
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
