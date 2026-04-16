#!/usr/bin/env python3
"""
Script to extract text from ITF Tennis Rules PDFs and upload to Supabase for embedding.

Requirements:
    pip install PyPDF2 requests

Usage:
    python process_tennis_rules_pdfs.py
"""

import json
import os
import requests
from typing import Dict, Any
import PyPDF2

# Configuration
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

PDF_DOCUMENTS = [
    {
        "file": "scripts/2026-rules-of-tennis-english.pdf",
        "language": "en",
        "title": "2026 ITF Rules of Tennis (English)",
        "year": 2026
    }
]

def extract_text_from_pdf_file(pdf_path: str) -> str:
    """Extract text from a local PDF file."""
    print(f"Reading PDF from {pdf_path}...")

    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    print("Extracting text from PDF...")
    with open(pdf_path, 'rb') as file:
        pdf_reader = PyPDF2.PdfReader(file)

        text = ""
        total_pages = len(pdf_reader.pages)

        for page_num, page in enumerate(pdf_reader.pages, 1):
            print(f"Processing page {page_num}/{total_pages}...")
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n\n"

    return text.strip()

def upload_document(doc_config: Dict[str, Any], text_content: str) -> Dict[str, Any]:
    """Upload document to the edge function for processing and embedding."""
    edge_function_url = f"{SUPABASE_URL}/functions/v1/process-tennis-rules-pdf"

    headers = {
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "pdfUrl": doc_config.get("file", "local_file"),
        "language": doc_config["language"],
        "title": doc_config["title"],
        "year": doc_config["year"],
        "textContent": text_content
    }

    print(f"Uploading to edge function...")
    response = requests.post(edge_function_url, headers=headers, json=payload, timeout=300)
    response.raise_for_status()

    return response.json()

def main():
    """Main processing function."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("Error: Environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set")
        return

    print("=" * 60)
    print("ITF Tennis Rules PDF Processor")
    print("=" * 60)
    print()

    for doc_config in PDF_DOCUMENTS:
        print(f"\nProcessing: {doc_config['title']}")
        print("-" * 60)

        try:
            # Extract text from PDF
            text_content = extract_text_from_pdf_file(doc_config["file"])
            print(f"Extracted {len(text_content)} characters")

            # Upload to edge function
            result = upload_document(doc_config, text_content)

            print(f"✓ Success!")
            print(f"  Document ID: {result.get('documentId')}")
            print(f"  Chunks processed: {result.get('chunksProcessed')}")
            print()

        except Exception as e:
            print(f"✗ Error processing {doc_config['title']}: {str(e)}")
            continue

    print("\n" + "=" * 60)
    print("Processing complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
