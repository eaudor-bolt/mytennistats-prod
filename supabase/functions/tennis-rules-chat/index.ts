import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, jsonOk, jsonError } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

// Abuse brake, not the product quota (that lives in user_usage_stats).
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60 * 60;

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_CHARS = 4000;

interface ChatRequest {
  message: string;
  language?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

/**
 * The history comes from the browser, so it is caller-controlled text that we
 * paste into a prompt. Keep only user/assistant turns - a forged `system` turn
 * would otherwise sit alongside our own instructions - and cap the volume so
 * the token bill per call is bounded.
 */
function sanitizeHistory(history: unknown): Array<{ role: string; content: string }> {
  if (!Array.isArray(history)) return [];

  return history
    .filter((m): m is { role: string; content: string } => {
      if (!m || typeof m !== "object") return false;
      const { role, content } = m as { role?: unknown; content?: unknown };
      return (role === "user" || role === "assistant") &&
        typeof content === "string" && content.length > 0;
    })
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CHARS) }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Every call here spends Mistral credits, so it needs a real account behind
  // it - the anon key in the browser bundle is not one.
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  try {
    if (!MISTRAL_API_KEY) {
      return jsonError("Mistral API key not configured", 500);
    }

    const { message, language = "en", conversationHistory = [] }: ChatRequest = await req
      .json()
      .catch(() => ({} as ChatRequest));

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return jsonError("Message is required", 400);
    }

    if (message.length > MAX_MESSAGE_CHARS) {
      return jsonError(`Message must be ${MAX_MESSAGE_CHARS} characters or fewer`, 400);
    }

    const safeLanguage = typeof language === "string" && /^[a-z]{2}$/i.test(language) ? language : "en";
    const history = sanitizeHistory(conversationHistory);

    const limited = await enforceRateLimit(
      supabase,
      user.id,
      "tennis-rules-chat",
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
    if (limited.response) return limited.response;

    // Step 1: Generate embedding for the user's question using Mistral
    const embeddingResponse = await fetch("https://api.mistral.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "mistral-embed", input: [message] }),
    });

    if (!embeddingResponse.ok) {
      console.error("Mistral embedding error:", await embeddingResponse.text());
      return jsonError("Failed to generate embedding", 502);
    }

    const embeddingData = await embeddingResponse.json();
    const questionEmbedding = embeddingData.data[0].embedding;

    // Step 2: Search for relevant chunks using vector similarity
    const { data: relevantChunks, error: searchError } = await supabase.rpc("search_tennis_rules", {
      query_embedding: questionEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      doc_language: safeLanguage,
    });

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
      ...history,
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
      console.error("Mistral chat error:", await chatResponse.text());
      return jsonError("Failed to get response from Mistral", 502);
    }

    const chatData = await chatResponse.json();
    const reply = chatData.choices[0]?.message?.content || "No response generated";

    return jsonOk({ reply, sources: relevantChunks?.length || 0 });
  } catch (error) {
    console.error("Error in tennis-rules-chat:", error);
    return jsonError("Internal server error", 500);
  }
});
