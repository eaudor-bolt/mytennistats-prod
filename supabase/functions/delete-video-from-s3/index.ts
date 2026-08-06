import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { S3Client, DeleteObjectsCommand } from "npm:@aws-sdk/client-s3@3.980.0";
import { corsHeaders, jsonOk, jsonError } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";

function keyFromUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  try {
    const key = new URL(url).pathname.substring(1);
    return key || null;
  } catch {
    return null;
  }
}

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
    const { videoId, s3Key: requestedKey } = body;

    if (!videoId && !requestedKey) {
      return jsonError("Missing videoId", 400);
    }

    /*
     * The key is never taken from the request. We look up the caller's own
     * `videos` row and derive the key from the URL we stored at upload time,
     * so a caller can only ever delete an object that is theirs. `s3Key` is
     * still accepted as a lookup hint for older clients, but it is matched
     * against the row rather than trusted.
     */
    let query = supabase.from("videos").select("id, url, poster_image").eq("user_id", user.id);
    if (videoId) {
      query = query.eq("id", videoId);
    } else {
      // Escape LIKE wildcards so the hint cannot widen the match.
      const escaped = String(requestedKey).replace(/[%_\\]/g, (c) => `\\${c}`);
      query = query.like("url", `%/${escaped}`);
    }

    const { data: video, error: lookupError } = await query.maybeSingle();

    if (lookupError) {
      console.error("Error looking up video:", lookupError);
      return jsonError("Failed to delete video", 500);
    }

    if (!video?.url) {
      // Either it does not exist or it belongs to someone else - same answer.
      return jsonError("Video not found", 404);
    }

    const s3Key = keyFromUrl(video.url);
    if (!s3Key) {
      return jsonError("Stored video URL is not usable", 422);
    }

    // The poster thumbnail (.jpg) is generated and stored alongside the mp4
    // at transcode time - delete it too, or it's left orphaned in S3 forever.
    // Older rows may predate poster generation, so this can be null.
    const posterKey = keyFromUrl(video.poster_image);

    const keys = posterKey ? [s3Key, posterKey] : [s3Key];
    const s3Client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
    const result = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );

    if (result.Errors && result.Errors.length > 0) {
      console.error("Error deleting video/poster from S3:", result.Errors);
      return jsonError("Failed to delete video", 500);
    }

    return jsonOk({ success: true });
  } catch (error: any) {
    console.error("Error deleting video from S3:", error);
    return jsonError("Failed to delete video", 500);
  }
});
