/*
  # Create Tennis Rules Embeddings Tables

  1. New Tables
    - `tennis_rules_documents`
      - `id` (uuid, primary key)
      - `title` (text) - Document title
      - `language` (text) - 'en' or 'fr'
      - `source_url` (text) - Original PDF URL
      - `year` (integer) - Rules year (e.g., 2026)
      - `processed_at` (timestamptz) - When the document was processed
      - `created_at` (timestamptz)
    
    - `tennis_rules_chunks`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to tennis_rules_documents)
      - `content` (text) - The actual text chunk
      - `chunk_index` (integer) - Position in document
      - `embedding` (vector(1024)) - Vector embedding for similarity search
      - `metadata` (jsonb) - Additional metadata (page number, section, etc.)
      - `created_at` (timestamptz)

  2. Indexes
    - Vector similarity search index on embeddings
    - Index on document_id for faster joins

  3. Security
    - Enable RLS on both tables
    - Public read access (rules are public information)
    - Only service role can insert/update (via edge functions)
*/

-- Create documents table
CREATE TABLE IF NOT EXISTS tennis_rules_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  language text NOT NULL CHECK (language IN ('en', 'fr')),
  source_url text NOT NULL,
  year integer NOT NULL DEFAULT 2026,
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create chunks table with embeddings
CREATE TABLE IF NOT EXISTS tennis_rules_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES tennis_rules_documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_index integer NOT NULL,
  embedding vector(1024),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON tennis_rules_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON tennis_rules_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS
ALTER TABLE tennis_rules_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tennis_rules_chunks ENABLE ROW LEVEL SECURITY;

-- Public read access (tennis rules are public information)
CREATE POLICY "Anyone can read tennis rules documents"
  ON tennis_rules_documents
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can read tennis rules chunks"
  ON tennis_rules_chunks
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role can manage documents (via edge functions)
CREATE POLICY "Service role can insert documents"
  ON tennis_rules_documents
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update documents"
  ON tennis_rules_documents
  FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can delete documents"
  ON tennis_rules_documents
  FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert chunks"
  ON tennis_rules_chunks
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update chunks"
  ON tennis_rules_chunks
  FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can delete chunks"
  ON tennis_rules_chunks
  FOR DELETE
  TO service_role
  USING (true);
