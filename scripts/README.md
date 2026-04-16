# Tennis Rules PDF Processing

This directory contains scripts to process the official ITF Tennis Rules PDFs and index them for RAG-based chat.

## Setup

### 1. Install Python Dependencies

```bash
pip install PyPDF2 requests
```

### 2. Set Environment Variables

Make sure your `.env` file contains:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
MISTRAL_API_KEY=your_mistral_api_key
```

Then export them:
```bash
source .env
export VITE_SUPABASE_URL
export VITE_SUPABASE_ANON_KEY
```

### 3. Run the Processing Script

```bash
python scripts/process_tennis_rules_pdfs.py
```

## What It Does

The script will:

1. **Download** the official ITF Tennis Rules PDFs (English and French versions)
2. **Extract** all text content from the PDFs
3. **Upload** the content to the `process-tennis-rules-pdf` edge function
4. The edge function will then:
   - Split the text into optimized chunks
   - Generate embeddings using Mistral's embedding model
   - Store everything in the Supabase database

## Documents Processed

- **English**: 2026 ITF Rules of Tennis (English)
  - URL: https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf

- **French**: 2026 ITF Rules of Tennis (French)
  - URL: https://www.itftennis.com/media/7222/2026-rules-of-tennis-french.pdf

## After Processing

Once the PDFs are processed and indexed, the tennis rules chat will:

- Use **Retrieval Augmented Generation (RAG)** to answer questions
- Search the official rules for relevant sections
- Provide accurate answers based on the official ITF documents
- Support both English and French queries

## Troubleshooting

### PDF Download Issues
If the PDFs fail to download, check:
- Your internet connection
- The URLs are still valid on itftennis.com

### Upload Issues
If the upload fails, verify:
- Your Supabase URL and API key are correct
- The edge function is deployed
- Your Mistral API key is configured in Supabase

### Processing Takes Long
Processing can take several minutes per document because:
- PDFs need to be downloaded and parsed
- Text is split into hundreds of chunks
- Each chunk needs an embedding generated
- All data is stored in the database

Be patient and let it complete!
