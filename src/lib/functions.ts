import { supabase } from './supabase';

/**
 * Edge functions that act on behalf of a user now resolve that user from the
 * JWT. Sending the anon key - which is what these calls used to do - proves
 * nothing: it ships in this bundle and is public by design. Send the signed-in
 * user's access token instead.
 */

export class NotSignedInError extends Error {
  constructor() {
    super('You must be signed in to do that');
    this.name = 'NotSignedInError';
  }
}

export function functionUrl(name: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
}

export async function functionAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new NotSignedInError();
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}
