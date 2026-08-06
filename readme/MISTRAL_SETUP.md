# Mistral AI Setup Guide

The tennis rules chat now uses **Mistral AI** with **RAG (Retrieval Augmented Generation)** to provide accurate answers based on the official ITF Tennis Rules documents.

## Why Mistral?

- **Cost-effective**: More affordable than OpenAI
- **Excellent performance**: Great quality for chat and embeddings
- **Official documents**: Uses actual ITF rules PDFs, not just general knowledge
- **Multilingual**: Native support for both English and French

## Setup Instructions

### 1. Get Your Mistral API Key

1. Go to https://console.mistral.ai/
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key
5. Copy the key (starts with something like `xxx...`)

### 2. Add API Key to Supabase

The Mistral API key needs to be configured as a secret in your Supabase project:

#### Option A: Using Supabase Dashboard
1. Go to your project dashboard: https://supabase.com/dashboard/project/teckcldrmwfxoxcinlhb
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add a new secret:
   - **Name**: `MISTRAL_API_KEY`
   - **Value**: Your Mistral API key

#### Option B: Using Supabase CLI (if available)
```bash
supabase secrets set MISTRAL_API_KEY=your_mistral_api_key_here
```

### 3. Process the Tennis Rules PDFs

After setting up the API key, you need to index the official ITF rules:

```bash
# Install Python dependencies
pip install PyPDF2 requests

# Export environment variables
export VITE_SUPABASE_URL=
export VITE_SUPABASE_ANON_KEY=

# Run the processing script
python scripts/process_tennis_rules_pdfs.py
```

This will download and index:
- 2026 ITF Rules of Tennis (English)
- 2026 ITF Rules of Tennis (French)

**Note**: Processing takes 5-10 minutes per document. Be patient!

### 4. Test the Chat

Once indexed, test the chat by asking questions like:
- "What are the rules for serving in tennis?"
- "How does the tiebreak work?"
- "What is a foot fault?"
- "Quelles sont les règles du service au tennis?" (French)

## How It Works

### RAG Architecture

1. **User asks a question** → "What is a let in tennis?"

2. **Question is embedded** → Converted to a 1024-dimensional vector using Mistral

3. **Similarity search** → Finds the most relevant sections from the official ITF rules

4. **Context is built** → Relevant rule sections are extracted

5. **Mistral generates answer** → Using the official rules as context

6. **User gets accurate answer** → Based on actual ITF documentation

### Benefits

- **Accurate**: Answers based on official ITF documents
- **Citable**: Can reference specific rule sections
- **Up-to-date**: Uses 2026 rules
- **Bilingual**: Works in English and French
- **Contextual**: Maintains conversation history

## API Costs

Mistral pricing (as of 2024):

- **mistral-embed**: ~$0.0001 per 1K tokens (embeddings)
- **mistral-small-latest**: ~$0.001 per 1K tokens (chat)

Typical costs per question: **< $0.001** (very affordable!)

## Edge Functions

Two edge functions power this system:

1. **`tennis-rules-chat`**
   - Handles user questions
   - Performs similarity search
   - Generates answers with Mistral

2. **`process-tennis-rules-pdf`**
   - Processes PDF documents
   - Chunks text appropriately
   - Generates and stores embeddings

## Database Tables

The system uses these tables:

- **`tennis_rules_documents`**: Metadata about indexed PDFs
- **`tennis_rules_chunks`**: Text chunks with their embeddings
- Uses **pgvector** extension for similarity search

## Troubleshooting

### Chat returns "API key not configured"
→ Make sure you added `MISTRAL_API_KEY` to Supabase secrets

### No relevant rules found
→ You need to run the PDF processing script first

### Processing script fails
→ Check your internet connection and verify the PDF URLs are accessible

### Embeddings search returns nothing
→ Wait for PDF processing to complete (can take 10-15 minutes total)

## Future Enhancements

Potential improvements:
- Add more tennis rules documents (ITF, ATP, WTA)
- Include rule amendments and updates
- Add visual diagrams and court images
- Support for more languages (Spanish, German, etc.)
- Fine-tune chunking strategy for better results
