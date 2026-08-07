import { functionAuthHeaders, functionUrl } from '../lib/functions';

/**
 * Takes the video's row id, not its URL. The edge function looks the row up
 * against the signed-in user and derives the S3 key from what we stored at
 * upload time, so the key is never client-supplied.
 */
export async function deleteVideoFromS3(videoId: string): Promise<boolean> {
  try {
    const response = await fetch(functionUrl('delete-video-from-s3'), {
      method: 'POST',
      headers: {
        ...(await functionAuthHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Error deleting video from S3:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting video from S3:', error);
    return false;
  }
}

/**
 * Deletes every point-clip video recorded for a match - the whole
 * mytennistats/match-videos/{userId}/{matchId}/ folder, not just the clips
 * scoring_history happens to reference. The edge function re-checks that the
 * caller owns this match before touching anything.
 */
export async function deleteMatchVideos(matchId: string): Promise<boolean> {
  try {
    const response = await fetch(functionUrl('delete-match-videos'), {
      method: 'POST',
      headers: {
        ...(await functionAuthHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ matchId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Error deleting match videos from S3:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting match videos from S3:', error);
    return false;
  }
}
