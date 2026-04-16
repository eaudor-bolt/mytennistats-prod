import { PostgrestError } from '@supabase/supabase-js';

export function handleSupabaseError(error: PostgrestError | Error | null): string {
  if (!error) return 'An unknown error occurred';

  if ('code' in error && error.code) {
    switch (error.code) {
      case 'PGRST301':
        return 'Session expired. Please sign in again.';
      case 'PGRST116':
        return 'Unable to connect to the database. Please check your connection.';
      case '23505':
        return 'This record already exists.';
      case '23503':
        return 'Cannot delete this record as it is referenced by other data.';
      case '42501':
        return 'You do not have permission to perform this action.';
      default:
        return error.message || 'A database error occurred';
    }
  }

  return error.message || 'An error occurred';
}

export function isAuthError(error: any): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('session') ||
    message.includes('unauthorized') ||
    message.includes('invalid_grant') ||
    message.includes('refresh_token_not_found')
  );
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < maxRetries - 1 && !isAuthError(error)) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}
