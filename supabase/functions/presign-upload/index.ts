import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  ListPartsCommand,
} from "npm:@aws-sdk/client-s3@3.980.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.980.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.39.3";
import { corsHeaders, jsonOk, jsonError } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";

const CLOUDFRONT_HOST = Deno.env.get("CLOUDFRONT_HOST") ?? "d2g92movh621e9.cloudfront.net";

const ALLOWED_FOLDERS = ["match-videos", "recorded-videos"] as const;
const ALLOWED_EXTENSIONS = new Set(["mp4", "webm", "mov", "avi", "m4v", "jpg", "jpeg", "png"]);
const ALLOWED_CONTENT_TYPES = /^(video|image)\/[a-z0-9.+-]+$/i;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * The only key shape this function will ever sign. Continuation actions
 * (presign-parts / list-parts / complete / abort) take a key from the client,
 * so it is re-checked against this before being handed to S3 - otherwise a
 * caller could name any object in the bucket and have us sign a write to it.
 *
 * Every key is scoped under a UUID folder: the live match id for
 * match-videos, or the uploader's user id for recorded-videos. See
 * README.md ("Video pipeline") for the full staged/final key layout.
 */
const KEY_PATTERN = new RegExp(
  `^mytennistats-import/(match-videos|recorded-videos)/${UUID}/${UUID}\\.[a-z0-9]{1,5}$`,
);

function getS3Client() {
  const region = Deno.env.get("AWS_REGION");
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("AWS_S3_BUCKET");

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing AWS configuration");
  }

  return {
    client: new S3Client({ region, credentials: { accessKeyId, secretAccessKey } }),
    bucket,
  };
}

/**
 * Builds the destination key. The caller's filename is used only to pick the
 * folder and the extension - never as part of the path. The leaf name is a
 * server-generated UUID, so a caller cannot aim an upload at an object that
 * already exists (which is how another user's video could be overwritten).
 *
 * Every key is scoped under a UUID folder so uploads from different users
 * (or different matches) never land in the same directory:
 *   - match-videos/{liveMatchId}/{uuid}.ext - the `{liveMatchId}/` segment
 *     comes from the client (Live Score groups a match's point clips under
 *     its match id). Being a UUID is not enough: live match ids are public,
 *     they appear in every /live/{id} share link, so the caller's ownership
 *     of that match is checked against the database before it is used.
 *   - recorded-videos/{userId}/{uuid}.ext - the `{userId}/` segment is never
 *     taken from the client; it's the authenticated caller's own id, so a
 *     user can only ever write under their own folder.
 */
type ParsedUpload = { folder: (typeof ALLOWED_FOLDERS)[number]; group: string | null; extension: string };

function parseUpload(filename: string): ParsedUpload | { error: string } {
  const raw = String(filename);

  if (raw.includes("..") || raw.includes("\\") || raw.startsWith("/")) {
    return { error: "Invalid filename" };
  }

  const segments = raw.split("/").filter(Boolean);
  if (segments.length === 0 || segments.length > 2) {
    return { error: "Invalid filename" };
  }

  const leaf = segments[segments.length - 1];
  const group = segments.length === 2 ? segments[0] : null;

  const folder: (typeof ALLOWED_FOLDERS)[number] = group ? "match-videos" : "recorded-videos";

  const extension = leaf.includes(".") ? leaf.split(".").pop()!.toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { error: "Unsupported file type" };
  }

  if (group && !new RegExp(`^${UUID}$`).test(group)) {
    return { error: "Invalid filename" };
  }

  return { folder, group, extension };
}

/** Is this live match the caller's own? Match ids are public, so this is the
 *  only thing standing between a caller and another user's match folder. */
async function ownsLiveMatch(
  supabase: SupabaseClient,
  userId: string,
  matchId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("live_matches")
    .select("id")
    .eq("id", matchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("live match ownership check failed:", error);
    return false;
  }
  return !!data;
}

function buildS3Key(parsed: ParsedUpload, scope: string): string {
  return `mytennistats-import/${parsed.folder}/${scope}/${crypto.randomUUID()}.${parsed.extension}`;
}

/**
 * Validates a key supplied by the client on a multipart continuation action.
 * Checks both that the key has the shape we issue *and* that its scope folder
 * belongs to this caller - for recorded-videos that the folder is their own
 * user id, for match-videos that they own the live match.
 */
async function assertCallerKey(
  key: unknown,
  userId: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) return null;

  const [, folder, group] = key.split("/");

  if (folder === "recorded-videos") {
    return group === userId ? key : null;
  }
  return (await ownsLiveMatch(supabase, userId, group)) ? key : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // A presigned S3 write is a credential. Only issue one to a real user - the
  // anon key that ships in the bundle is not one.
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action;

    const { client, bucket } = getS3Client();

    if (action === "presign-single" || action === "initiate-multipart") {
      const { filename, contentType } = body;
      if (!filename || !contentType) return jsonError("Missing filename or contentType", 400);
      if (!ALLOWED_CONTENT_TYPES.test(String(contentType))) {
        return jsonError("Unsupported content type", 400);
      }

      const parsed = parseUpload(filename);
      if ("error" in parsed) return jsonError(parsed.error, 400);

      // match-videos groups under a live match id, which is public - so prove
      // the caller owns that match before writing into its folder.
      if (parsed.group && !(await ownsLiveMatch(supabase, user.id, parsed.group))) {
        return jsonError("Unknown live match", 403);
      }

      const s3Key = buildS3Key(parsed, parsed.group ?? user.id);

      if (action === "presign-single") {
        const command = new PutObjectCommand({ Bucket: bucket, Key: s3Key, ContentType: contentType });
        const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
        return jsonOk({ presignedUrl, key: s3Key, cloudfrontUrl: cloudfront(s3Key) });
      }

      const result = await client.send(
        new CreateMultipartUploadCommand({ Bucket: bucket, Key: s3Key, ContentType: contentType }),
      );
      return jsonOk({ uploadId: result.UploadId, key: s3Key, cloudfrontUrl: cloudfront(s3Key) });
    }

    if (action === "presign-parts") {
      const { key, uploadId, partNumbers } = body;
      const safeKey = await assertCallerKey(key, user.id, supabase);
      if (!safeKey || !uploadId || !Array.isArray(partNumbers) || partNumbers.length === 0) {
        return jsonError("Missing or invalid key, uploadId or partNumbers", 400);
      }
      if (partNumbers.length > 10000) return jsonError("Too many parts", 400);

      const urls: Record<number, string> = {};
      for (const partNumber of partNumbers) {
        if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
          return jsonError("Invalid part number", 400);
        }
        const command = new UploadPartCommand({
          Bucket: bucket,
          Key: safeKey,
          UploadId: uploadId,
          PartNumber: partNumber,
        });
        urls[partNumber] = await getSignedUrl(client, command, { expiresIn: 3600 });
      }

      return jsonOk({ urls });
    }

    if (action === "list-parts") {
      const { key, uploadId } = body;
      const safeKey = await assertCallerKey(key, user.id, supabase);
      if (!safeKey || !uploadId) return jsonError("Missing or invalid key or uploadId", 400);

      const result = await client.send(
        new ListPartsCommand({ Bucket: bucket, Key: safeKey, UploadId: uploadId }),
      );

      const parts = (result.Parts ?? []).map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag }));
      return jsonOk({ parts });
    }

    if (action === "complete-multipart") {
      const { key, uploadId, parts } = body;
      const safeKey = await assertCallerKey(key, user.id, supabase);
      if (!safeKey || !uploadId || !parts) {
        return jsonError("Missing or invalid key, uploadId or parts", 400);
      }

      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: safeKey,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        }),
      );

      return jsonOk({ key: safeKey, cloudfrontUrl: cloudfront(safeKey) });
    }

    if (action === "abort-multipart") {
      const { key, uploadId } = body;
      const safeKey = await assertCallerKey(key, user.id, supabase);
      if (!safeKey || !uploadId) return jsonError("Missing or invalid key or uploadId", 400);

      await client.send(
        new AbortMultipartUploadCommand({ Bucket: bucket, Key: safeKey, UploadId: uploadId }),
      );
      return jsonOk({ aborted: true });
    }

    return jsonError(`Unknown action: ${action}`, 400);
  } catch (error: any) {
    console.error("presign-upload error:", error);
    return jsonError("Internal error", 500);
  }
});

function cloudfront(key: string): string {
  return `https://${CLOUDFRONT_HOST}/${key}`;
}