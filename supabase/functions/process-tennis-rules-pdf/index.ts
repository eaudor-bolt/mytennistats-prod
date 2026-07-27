import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface ProcessRequest {
  pdfUrl: string;
  language: string;
  title: string;
  year: number;
}

// Helper function to chunk text
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    
    // If not at the end, try to break at a sentence or paragraph
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > start + chunkSize / 2) {
        end = breakPoint + 1;
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }
  
  return chunks;
}

// Simple PDF text extraction using pdf.js-like approach
// For production, you'd want a more robust solution
async function extractTextFromPDF(pdfUrl: string): Promise<string> {
  try {
    // For now, we'll use a PDF to text conversion service
    // In production, you might use a dedicated service or library
    const response = await fetch(pdfUrl);
    const arrayBuffer = await response.arrayBuffer();
    
    // Since direct PDF parsing in Deno is complex, we'll provide instructions
    // for manual text extraction or use an external service
    // For this implementation, we'll expect pre-extracted text
    
    throw new Error("PDF parsing not yet implemented. Please provide text content directly.");
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Maintenance endpoint, not a user-facing one: it writes the shared rules
 * index with the service role and pays Mistral to embed whatever text it is
 * given. No end user should ever reach it, so it is gated on a shared secret
 * rather than a user JWT. Set ADMIN_TASK_SECRET in the function secrets and
 * pass it as `X-Admin-Secret` (see scripts/process_tennis_rules_pdfs.py).
 */
function isAuthorizedAdmin(req: Request): boolean {
  const expected = Deno.env.get("ADMIN_TASK_SECRET");
  if (!expected) return false;

  const provided = req.headers.get("X-Admin-Secret") ?? "";
  if (provided.length !== expected.length) return false;

  // Constant-time compare so the secret cannot be recovered byte by byte.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (!isAuthorizedAdmin(req)) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    if (!MISTRAL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Mistral API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { pdfUrl, language, title, year, textContent }: ProcessRequest & { textContent?: string } = body;

    if (!textContent) {
      return new Response(
        JSON.stringify({ 
          error: "Text content is required",
          message: "Please provide the extracted text content in the 'textContent' field. PDF parsing will be added in a future update."
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Step 1: Create document record
    const { data: document, error: docError } = await supabase
      .from('tennis_rules_documents')
      .insert({
        title,
        language,
        source_url: pdfUrl,
        year,
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Failed to create document: ${docError.message}`);
    }

    // Step 2: Chunk the text
    const chunks = chunkText(textContent, 800, 150);
    console.log(`Created ${chunks.length} chunks for document ${document.id}`);

    // Step 3: Generate embeddings for all chunks (batch processing)
    const batchSize = 10;
    let processedChunks = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, Math.min(i + batchSize, chunks.length));
      
      // Generate embeddings for this batch
      const embeddingResponse = await fetch("https://api.mistral.ai/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-embed",
          input: batch,
        }),
      });

      if (!embeddingResponse.ok) {
        const errorData = await embeddingResponse.text();
        console.error("Mistral embedding error:", errorData);
        throw new Error("Failed to generate embeddings");
      }

      const embeddingData = await embeddingResponse.json();
      
      // Step 4: Store chunks with embeddings
      const chunksToInsert = batch.map((content, batchIndex) => ({
        document_id: document.id,
        content,
        chunk_index: i + batchIndex,
        embedding: embeddingData.data[batchIndex].embedding,
        metadata: {
          chunk_size: content.length,
          batch: Math.floor(i / batchSize),
        },
      }));

      const { error: insertError } = await supabase
        .from('tennis_rules_chunks')
        .insert(chunksToInsert);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }

      processedChunks += batch.length;
      console.log(`Processed ${processedChunks}/${chunks.length} chunks`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        documentId: document.id,
        chunksProcessed: chunks.length,
        message: "Tennis rules document processed and indexed successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in process-tennis-rules-pdf:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});