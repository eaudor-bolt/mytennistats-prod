import { functionAuthHeaders, functionUrl } from '../lib/functions';

export interface S3UploadResult {
  key: string;
  presignedUrl: string;
}

const MULTIPART_THRESHOLD = 10 * 1024 * 1024;
const PART_SIZE = 10 * 1024 * 1024;
const PRESIGN_URL = functionUrl('presign-upload');

// Uploads land under this staging prefix; the external transcode pipeline
// (cdk-lambda-ffmpeg, not in this repo) mirrors the finished file under this
// output prefix once it's done. This is the one and only place that
// staging-to-final substitution happens - see README.md ("Video pipeline").
const STAGING_PREFIX = '/mytennistats-import/';
const FINAL_PREFIX = '/mytennistats/';

/**
 * Converts the CloudFront URL handed back by presign-upload (still pointing
 * at the staging prefix, since the file hasn't been transcoded yet) into the
 * URL it will resolve to once that finishes. The predicted URL is stored
 * immediately - the app never waits for the transcode to complete.
 */
export function toFinalVideoUrl(stagingUrl: string): string {
  return stagingUrl.replace(STAGING_PREFIX, FINAL_PREFIX);
}

async function callPresignApi(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { ...(await functionAuthHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Presign API error ${res.status}`);
  }
  return res.json();
}

async function uploadSingle(
  file: Blob,
  filename: string,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<S3UploadResult> {
  const { presignedUrl, key, cloudfrontUrl } = await callPresignApi({
    action: 'presign-single',
    filename,
    contentType,
  });

  await uploadWithProgress(presignedUrl, file, contentType, onProgress);

  return { key, presignedUrl: cloudfrontUrl };
}

async function uploadMultipart(
  file: Blob,
  filename: string,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<S3UploadResult> {
  const { uploadId, key, cloudfrontUrl } = await callPresignApi({
    action: 'initiate-multipart',
    filename,
    contentType,
  });

  const totalParts = Math.ceil(file.size / PART_SIZE);
  const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);

  const { urls } = await callPresignApi({
    action: 'presign-parts',
    key,
    uploadId,
    partNumbers,
  });

  let uploadedBytes = 0;

  try {
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      const partBlob = file.slice(start, end);
      const presignedUrl = urls[partNumber];

      await uploadWithProgress(presignedUrl, partBlob, contentType, (partPct) => {
        if (onProgress) {
          const baseProgress = (uploadedBytes / file.size) * 100;
          const partContribution = (partBlob.size / file.size) * partPct;
          onProgress(Math.min(99, Math.round(baseProgress + partContribution)));
        }
      });

      uploadedBytes += partBlob.size;
      if (onProgress) onProgress(Math.round((uploadedBytes / file.size) * 100));
    }

    const { parts } = await callPresignApi({ action: 'list-parts', key, uploadId });

    await callPresignApi({
      action: 'complete-multipart',
      key,
      uploadId,
      parts,
    });

    return { key, presignedUrl: cloudfrontUrl };
  } catch (error) {
    await callPresignApi({ action: 'abort-multipart', key, uploadId }).catch(() => {});
    throw error;
  }
}

function uploadWithProgress(
  presignedUrl: string,
  body: Blob,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', contentType);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(body);
  });
}

export async function uploadVideoToS3(
  videoBlob: Blob,
  filename: string,
  onProgress?: (pct: number) => void,
  onError?: (message: string) => void
): Promise<S3UploadResult | null> {
  try {
    const contentType = videoBlob.type || 'video/mp4';

    if (videoBlob.size >= MULTIPART_THRESHOLD) {
      return await uploadMultipart(videoBlob, filename, contentType, onProgress);
    } else {
      return await uploadSingle(videoBlob, filename, contentType, onProgress);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error uploading video to S3:', error);
    onError?.(message);
    return null;
  }
}
