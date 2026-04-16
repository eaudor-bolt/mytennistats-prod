export async function deleteVideoFromS3(videoUrl: string): Promise<boolean> {
  try {
    const url = new URL(videoUrl);
    const s3Key = url.pathname.substring(1);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-video-from-s3`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ s3Key }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error deleting video from S3:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting video from S3:', error);
    return false;
  }
}
