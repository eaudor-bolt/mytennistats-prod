import { createClient, SupabaseClient, User } from "npm:@supabase/supabase-js@2.39.3";
import { jsonError } from "./http.ts";

/**
 * `verify_jwt` is not authentication.
 *
 * It only proves the caller presented *a* valid JWT signed by this project -
 * and the anon key is exactly that. The anon key ships in the browser bundle
 * (and is committed in readme/MISTRAL_SETUP.md), so every request that reaches
 * a function has already cleared `verify_jwt`. Anything that acts on behalf of
 * a user must resolve that user itself, which is what this does.
 */

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export type AuthResult =
  | { user: User; supabase: SupabaseClient; response?: undefined }
  | { user?: undefined; supabase?: undefined; response: Response };

/**
 * Resolves the end user behind the request, or returns a 401 Response to send
 * back. A bare anon key carries no user and is rejected here.
 */
export async function requireUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: jsonError("Unauthorized", 401) };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { response: jsonError("Unauthorized", 401) };
  }

  let supabase: SupabaseClient;
  try {
    supabase = serviceClient();
  } catch (error) {
    console.error("auth: service client unavailable:", error);
    return { response: jsonError("Server misconfigured", 500) };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    // The anon key is a valid project JWT with no `sub`, so it lands here.
    return { response: jsonError("Unauthorized", 401) };
  }

  return { user: data.user, supabase };
}
