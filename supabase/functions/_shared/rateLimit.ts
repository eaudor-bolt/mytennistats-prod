import { SupabaseClient } from "npm:@supabase/supabase-js@2.39.3";
import { jsonError } from "./http.ts";

/**
 * Per-user ceiling on the functions that spend money with a third party
 * (Mistral, Groq). This is an abuse brake, not the product limit - the
 * free/premium quotas in `user_usage_stats` stay where they are. Limits here
 * are set well above what a real session needs, so a normal user never sees
 * one; a script hammering the endpoint does.
 */

export type RateLimitOutcome = { response?: Response };

export async function enforceRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitOutcome> {
  const { data, error } = await supabase.rpc("consume_ai_rate_limit", {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Fail closed: an endpoint that bills a third party should not fall open
    // when its own brake is broken.
    console.error(`rate limit check failed for ${endpoint}:`, error);
    return { response: jsonError("Rate limit unavailable, try again shortly", 503) };
  }

  if (!data?.allowed) {
    const retryAfter = Math.max(1, Number(data?.retry_after_seconds ?? windowSeconds));
    return {
      response: new Response(
        JSON.stringify({
          error: "Too many requests",
          retry_after_seconds: retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
          },
        },
      ),
    };
  }

  return {};
}
