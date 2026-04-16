import { supabase } from '../lib/supabase';
import tournamentsData from '../data/tournaments.json';

export async function importTournaments() {
  const tournaments = tournamentsData.map(t => ({
    organizer: t.organizer,
    title: t.title,
    description: t.description || '',
    start_date: t.start_date,
    end_date: t.end_date,
    judge_arbitrator: t.judge_arbitrator,
    surface: t.surface,
    cash_prize: t.cash_prize,
    prizes_lots: t.prizes_lots,
    online_registration: t.online_registration,
    online_payment: t.online_payment,
    event_code: t.event_code,
    contact_email: t.contact_email,
    venue_name: t.venue_name,
    venue_address: t.venue_address,
    venue_city: t.venue_city,
    venue_postal_code: t.venue_postal_code,
    venue_phone: t.venue_phone,
    latitude: t.location && t.location[1] ? parseFloat(t.location[1]) : null,
    longitude: t.location && t.location[0] ? parseFloat(t.location[0]) : null,
    categories: t.categories,
    date_ouverture_inscription: t.dateOuvertureInscriptionEnLigne,
    status: determineStatus(t.start_date, t.end_date),
  }));

  const { data, error } = await supabase
    .from('tournaments')
    .upsert(tournaments, { onConflict: 'event_code' });

  if (error) {
    console.error('Error importing tournaments:', error);
    return { success: false, error };
  }

  return { success: true, data };
}

function determineStatus(startDate: string, endDate: string): string {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return 'upcoming';
  if (now > end) return 'completed';
  return 'ongoing';
}
