import { functionAuthHeaders, functionUrl } from '../lib/functions';

/**
 * Cleans up every video the user has in S3 (Videos page uploads and Live
 * Score point recordings) before removing their account rows, then removes
 * the account itself. See supabase/functions/delete-account.
 */
export async function deleteAccount(): Promise<void> {
  const response = await fetch(functionUrl('delete-account'), {
    method: 'POST',
    headers: {
      ...(await functionAuthHeaders()),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete account');
  }
}
