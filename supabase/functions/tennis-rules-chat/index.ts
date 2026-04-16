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

interface ChatRequest {
  message: string;
  language?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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

    const { message, language = 'en', conversationHistory = [] }: ChatRequest = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Step 1: Generate embedding for the user's question using Mistral
    const embeddingResponse = await fetch("https://api.mistral.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-embed",
        input: [message],
      }),
    });

    if (!embeddingResponse.ok) {
      const errorData = await embeddingResponse.text();
      console.error("Mistral embedding error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to generate embedding", details: errorData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const questionEmbedding = embeddingData.data[0].embedding;

    // Step 2: Search for relevant chunks using vector similarity
    const { data: relevantChunks, error: searchError } = await supabase.rpc(
      'search_tennis_rules',
      {
        query_embedding: questionEmbedding,
        match_threshold: 0.5,
        match_count: 5,
        doc_language: language
      }
    );

    if (searchError) {
      console.error("Search error:", searchError);
    }

    // Step 3: Build context from relevant chunks
    let context = "";
    if (relevantChunks && relevantChunks.length > 0) {
      context = "Official ITF Tennis Rules (relevant sections):\n\n";
      relevantChunks.forEach((chunk: any, index: number) => {
        context += `[Section ${index + 1}]\n${chunk.content}\n\n`;
      });
    } else {
      context = "No specific rule sections found. Using general tennis knowledge.";
    }

    // Step 4: Build messages for Mistral chat
    const systemPrompt = `You are a tennis rules expert assistant. Answer questions about tennis rules based on the official ITF (International Tennis Federation) rules provided.

When answering:
- Use the official rules context provided below
- Be clear, accurate, and helpful
- Cite specific rule sections when relevant
- If the question is not covered in the provided context, say so and provide general tennis knowledge
- IMPORTANT: Always respond in the SAME LANGUAGE as the user's question. If the user asks in French, respond in French. If the user asks in English, respond in English. If the user asks in any other language, respond in that language.

${context}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    // Step 5: Call Mistral chat API
    const chatResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!chatResponse.ok) {
      const errorData = await chatResponse.text();
      console.error("Mistral chat error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to get response from Mistral", details: errorData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const chatData = await chatResponse.json();
    const reply = chatData.choices[0]?.message?.content || "No response generated";

    return new Response(
      JSON.stringify({ 
        reply,
        sources: relevantChunks?.length || 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in tennis-rules-chat:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});