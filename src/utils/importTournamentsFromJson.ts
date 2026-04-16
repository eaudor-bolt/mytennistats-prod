import { supabase } from '../lib/supabase';
import tournamentsData from '../data/tournaments.json';

export async function importTournamentsFromJson() {
  try {
    console.log('Starting tournament import from JSON...');

    const tournaments = tournamentsData as any[];
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const tournament of tournaments) {
      if (!tournament.event_code) {
        console.warn('Tournament missing event_code, skipping:', tournament.title);
        skipped++;
        continue;
      }

      const [longitude, latitude] = tournament.location || [null, null];

      const tournamentData = {
        organizer: tournament.organizer || '',
        title: tournament.title || '',
        description: tournament.description || '',
        start_date: tournament.start_date,
        end_date: tournament.end_date,
        judge_arbitrator: tournament.judge_arbitrator || null,
        surface: tournament.surface || null,
        cash_prize: tournament.cash_prize || 0,
        prizes_lots: tournament.prizes_lots || 0,
        online_registration: tournament.online_registration || false,
        online_payment: tournament.online_payment || false,
        event_code: tournament.event_code,
        contact_email: tournament.contact_email || null,
        venue_name: tournament.venue_name || null,
        venue_address: tournament.venue_address || null,
        venue_city: tournament.venue_city || null,
        venue_postal_code: tournament.venue_postal_code || null,
        venue_phone: tournament.venue_phone || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        categories: tournament.categories || [],
        date_ouverture_inscription: tournament.dateOuvertureInscriptionEnLigne || null,
      };

      const { data: existing } = await supabase
        .from('tournaments')
        .select('id')
        .eq('event_code', tournament.event_code)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('tournaments')
          .update(tournamentData)
          .eq('id', existing.id);

        if (error) {
          console.error('Error updating tournament:', error);
        } else {
          updated++;
        }
      } else {
        const { error } = await supabase
          .from('tournaments')
          .insert(tournamentData);

        if (error) {
          console.error('Error inserting tournament:', error);
        } else {
          imported++;
        }
      }
    }

    console.log(`Import completed: ${imported} imported, ${updated} updated, ${skipped} skipped`);
    return { success: true, imported, updated, skipped };
  } catch (error) {
    console.error('Error importing tournaments:', error);
    return { success: false, error };
  }
}
