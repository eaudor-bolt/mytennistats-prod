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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getS3Client() {
  const region = Deno.env.get("AWS_REGION");
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("AWS_S3_BUCKET");

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing AWS configuration");
  }

  return {
    client: new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  };
}

function buildS3Key(filename: string): string {
  const folder = filename.includes("/") ? "match-videos" : "recorded-videos";
  return `import/${folder}/${filename}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action;

    const { client, bucket } = getS3Client();

    if (action === "presign-single") {
      const { filename, contentType } = body;
      if (!filename || !contentType) return jsonError("Missing filename or contentType", 400);

      const s3Key = buildS3Key(filename);
      const command = new PutObjectCommand({ Bucket: bucket, Key: s3Key, ContentType: contentType });
      const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

      return jsonOk({ presignedUrl, key: s3Key, cloudfrontUrl: cloudfront(s3Key) });
    }

    if (action === "initiate-multipart") {
      const { filename, contentType } = body;
      if (!filename || !contentType) return jsonError("Missing filename or contentType", 400);

      const s3Key = buildS3Key(filename);
      const result = await client.send(
        new CreateMultipartUploadCommand({ Bucket: bucket, Key: s3Key, ContentType: contentType })
      );

      return jsonOk({ uploadId: result.UploadId, key: s3Key, cloudfrontUrl: cloudfront(s3Key) });
    }

    if (action === "presign-parts") {
      const { key, uploadId, partNumbers } = body;
      if (!key || !uploadId || !Array.isArray(partNumbers) || partNumbers.length === 0) {
        return jsonError("Missing key, uploadId or partNumbers", 400);
      }

      const urls: Record<number, string> = {};
      for (const partNumber of partNumbers) {
        const command = new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        });
        urls[partNumber] = await getSignedUrl(client, command, { expiresIn: 3600 });
      }

      return jsonOk({ urls });
    }

    if (action === "list-parts") {
      const { key, uploadId } = body;
      if (!key || !uploadId) return jsonError("Missing key or uploadId", 400);

      const result = await client.send(
        new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId })
      );

      const parts = (result.Parts ?? []).map((p) => ({
        PartNumber: p.PartNumber,
        ETag: p.ETag,
      }));

      return jsonOk({ parts });
    }

    if (action === "complete-multipart") {
      const { key, uploadId, parts } = body;
      if (!key || !uploadId || !parts) return jsonError("Missing key, uploadId or parts", 400);

      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        })
      );

      return jsonOk({ key, cloudfrontUrl: cloudfront(key) });
    }

    if (action === "abort-multipart") {
      const { key, uploadId } = body;
      if (!key || !uploadId) return jsonError("Missing key or uploadId", 400);

      await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
      return jsonOk({ aborted: true });
    }

    return jsonError(`Unknown action: ${action}`, 400);
  } catch (error: any) {
    console.error("presign-upload error:", error);
    return jsonError(error.message ?? "Internal error", 500);
  }
});

function cloudfront(key: string): string {
  return `https://d2g92movh621e9.cloudfront.net/${key}`;
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
