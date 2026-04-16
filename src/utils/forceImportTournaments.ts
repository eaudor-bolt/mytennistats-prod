import { supabase } from '../lib/supabase';
import { importTournaments } from './importTournaments';

export async function forceImportTournaments() {
  console.log('Starting tournament import...');

  const { error: deleteError } = await supabase
    .from('tournaments')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (deleteError) {
    console.error('Error clearing tournaments:', deleteError);
    return { success: false, error: deleteError };
  }

  console.log('Cleared existing tournaments, importing new data...');

  const result = await importTournaments();

  if (result.success) {
    console.log('Successfully imported tournaments!');
  } else {
    console.error('Failed to import tournaments:', result.error);
  }

  return result;
}

if (typeof window !== 'undefined') {
  (window as any).forceImportTournaments = forceImportTournaments;
}
