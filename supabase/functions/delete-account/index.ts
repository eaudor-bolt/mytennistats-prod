import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { S3Client, DeleteObjectsCommand } from "npm:@aws-sdk/client-s3@3.980.0";
import { corsHeaders, jsonOk, jsonError } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";

/**
 * Deleting an account must also delete every video the user ever put in S3 -
 * both from the Videos page (`videos` table) and the per-point clips recorded
 * during Live Score (embedded as `videoUrl` inside `scoring_history` on
 * `live_matches` and `match_results`). Postgres has no route to S3, so this
 * has to happen here, before the DB rows (and the URLs they hold) are gone.
 *
 * One batch `DeleteObjectsCommand` (up to 1000 keys per call) instead of one
 * `DeleteObjectCommand` per video - a user with hundreds of clips would
 * otherwise mean hundreds of round trips for what is a single user action.
 */

function keyFromUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  try {
    const key = new URL(url).pathname.substring(1);
    return key || null;
  } catch {
    return null;
  }
}

function collectScoringHistoryKeys(rows: { scoring_history: unknown }[] | null): string[] {
  const keys: string[] = [];
  for (const row of rows ?? []) {
    const history = row.scoring_history;
    if (!Array.isArray(history)) continue;
    for (const entry of history) {
      const key = keyFromUrl(entry?.videoUrl);
      if (key) keys.push(key);
    }
  }
  return keys;
}

async function deleteKeysFromS3(keys: string[]): Promise<{ attempted: number; errors: string[] }> {
  if (keys.length === 0) return { attempted: 0, errors: [] };

  const region = Deno.env.get("AWS_REGION");
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("AWS_S3_BUCKET");

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    return { attempted: keys.length, errors: ["Missing AWS configuration"] };
  }

  const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  const errors: string[] = [];

  // S3 DeleteObjects caps out at 1000 keys per request.
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    try {
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      for (const err of result.Errors ?? []) {
        errors.push(`${err.Key}: ${err.Message ?? err.Code ?? "unknown error"}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { attempted: keys.length, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  try {
    // `supabase` here is service-role (see _shared/auth.ts) - RLS does not
    // apply, so every query below filters by this user's id explicitly.
    const [videosResult, liveMatchesResult, matchResultsResult] = await Promise.all([
      supabase.from("videos").select("url, poster_image").eq("user_id", user.id),
      supabase.from("live_matches").select("scoring_history").eq("user_id", user.id),
      supabase.from("match_results").select("scoring_history").eq("user_id", user.id),
    ]);

    if (videosResult.error || liveMatchesResult.error || matchResultsResult.error) {
      console.error(
        "delete-account: failed to gather video references:",
        videosResult.error ?? liveMatchesResult.error ?? matchResultsResult.error,
      );
      return jsonError("Failed to gather account videos", 500);
    }

    const keys = new Set<string>();
    for (const video of videosResult.data ?? []) {
      const urlKey = keyFromUrl(video.url);
      if (urlKey) keys.add(urlKey);
      const posterKey = keyFromUrl(video.poster_image);
      if (posterKey) keys.add(posterKey);
    }
    for (const key of collectScoringHistoryKeys(liveMatchesResult.data)) keys.add(key);
    for (const key of collectScoringHistoryKeys(matchResultsResult.data)) keys.add(key);

    // Best-effort: a flaky S3 call should never block a user from deleting
    // their account. Failures are logged, not surfaced as a hard error.
    const { attempted, errors } = await deleteKeysFromS3([...keys]);
    if (errors.length > 0) {
      console.error("delete-account: some S3 deletes failed:", errors);
    }

    // Runs as the caller (forwarding their own token, not service role) so
    // the existing `auth.uid() = p_user_id` check inside the function still
    // holds - this function's job is S3 cleanup, not re-litigating who owns
    // the account.
    const authHeader = req.headers.get("Authorization")!;
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );

    const { error: rpcError } = await userClient.rpc("delete_user_account", { p_user_id: user.id });
    if (rpcError) {
      console.error("delete-account: delete_user_account RPC failed:", rpcError);
      return jsonError("Failed to delete account", 500);
    }

    return jsonOk({ success: true, videosDeleted: attempted, s3Errors: errors.length });
  } catch (error: any) {
    console.error("delete-account error:", error);
    return jsonError("Failed to delete account", 500);
  }
});
