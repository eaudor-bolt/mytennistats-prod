import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "npm:@aws-sdk/client-s3@3.980.0";
import { corsHeaders, jsonOk, jsonError } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MATCH_ID_PATTERN = new RegExp(`^${UUID}$`);

/*
 * Deleting a match deletes its whole point-clip video folder, not just the
 * clips scoring_history happens to reference - ListObjectsV2 by prefix
 * rather than deleting one key per scoring_history entry, so nothing gets
 * left behind (a clip a client-side bug failed to record, a retried upload
 * that landed under a different uuid, etc.).
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  try {
    const region = Deno.env.get("AWS_REGION");
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("AWS_S3_BUCKET");

    if (!region || !accessKeyId || !secretAccessKey || !bucket) {
      return jsonError("Missing AWS configuration", 500);
    }

    const body = await req.json().catch(() => ({}));
    const { matchId } = body;

    if (typeof matchId !== "string" || !MATCH_ID_PATTERN.test(matchId)) {
      return jsonError("Missing or invalid matchId", 400);
    }

    // matchId alone doesn't prove ownership - it's public (it's the id in
    // every /shared-game/{id} link) - so confirm this caller actually owns
    // the match before touching anything under its folder.
    const { data: match, error: lookupError } = await supabase
      .from("match_results")
      .select("id")
      .eq("id", matchId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      console.error("Error looking up match:", lookupError);
      return jsonError("Failed to delete match videos", 500);
    }

    if (!match) {
      // Either it does not exist or it belongs to someone else - same answer.
      return jsonError("Match not found", 404);
    }

    // Built from the authenticated caller's own id and the now-verified
    // matchId - never taken from the client - so this can only ever target
    // the caller's own folder. Matches the key convention presign-upload
    // mints at upload time (buildS3Key): mytennistats/match-videos/{userId}/{matchId}/...
    const prefix = `mytennistats/match-videos/${user.id}/${matchId}/`;

    const s3Client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });

    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const listResult = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const obj of listResult.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }
      continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined;
    } while (continuationToken);

    const errors: string[] = [];
    // S3 DeleteObjects caps out at 1000 keys per request.
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      const result = await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      for (const err of result.Errors ?? []) {
        errors.push(`${err.Key}: ${err.Message ?? err.Code ?? "unknown error"}`);
      }
    }

    if (errors.length > 0) {
      console.error("delete-match-videos: some S3 deletes failed:", errors);
    }

    return jsonOk({ success: true, deleted: keys.length, errors: errors.length });
  } catch (error: any) {
    console.error("Error deleting match videos:", error);
    return jsonError("Failed to delete match videos", 500);
  }
});
