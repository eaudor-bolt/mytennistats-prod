import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3.980.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const region = Deno.env.get("AWS_REGION");
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("AWS_S3_BUCKET");

    if (!region || !accessKeyId || !secretAccessKey || !bucket) {
      return new Response(
        JSON.stringify({ error: "Missing AWS configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { s3Key } = await req.json();

    if (!s3Key) {
      return new Response(
        JSON.stringify({ error: "Missing s3Key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const s3Client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key }));

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error deleting video from S3:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete video", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
