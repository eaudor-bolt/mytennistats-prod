import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, jsonOk, jsonError } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

// Abuse brake, not the product quota (that lives in user_usage_stats).
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60 * 60;

// Groq's own Whisper limit; rejecting here avoids paying to find out.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Every call here spends Groq credits, so it needs a real account behind it.
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  try {
    if (!GROQ_API_KEY) {
      return jsonError("Groq API key not configured", 500, {
        message: "Please add GROQ_API_KEY to your Supabase edge function secrets",
      });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonError("Content-Type must be multipart/form-data", 400);
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const language = (formData.get("language") as string) || "auto";

    if (!audioFile) {
      return jsonError("No audio file provided", 400);
    }

    if (audioFile.size > MAX_AUDIO_BYTES) {
      return jsonError("Audio file too large", 413);
    }

    const limited = await enforceRateLimit(
      supabase,
      user.id,
      "transcribe-audio",
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    );
    if (limited.response) return limited.response;

    // Create a new FormData for Groq API
    const groqFormData = new FormData();
    groqFormData.append("file", audioFile, "audio.webm");
    groqFormData.append("model", "whisper-large-v3");
    groqFormData.append("response_format", "json");

    // Auto-detect language or specify French/English
    if (language !== "auto" && /^[a-z]{2}$/i.test(language)) {
      groqFormData.append("language", language);
    }

    // Call Groq Whisper API
    const transcriptionResponse = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: groqFormData,
      },
    );

    if (!transcriptionResponse.ok) {
      console.error("Groq transcription error:", await transcriptionResponse.text());
      return jsonError("Failed to transcribe audio", 502);
    }

    const transcriptionData = await transcriptionResponse.json();

    return jsonOk({
      text: transcriptionData.text,
      language: transcriptionData.language || language,
    });
  } catch (error) {
    console.error("Error in transcribe-audio:", error);
    return jsonError("Internal server error", 500);
  }
});
