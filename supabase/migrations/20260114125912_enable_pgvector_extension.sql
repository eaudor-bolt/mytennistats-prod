/*
  # Enable pgvector extension for embeddings

  1. Extensions
    - Enable `vector` extension for storing and querying embeddings
  
  2. Notes
    - This extension allows us to store vector embeddings and perform similarity searches
    - Required for RAG (Retrieval Augmented Generation) implementation
*/

CREATE EXTENSION IF NOT EXISTS vector;
