import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Supabase's default cross-tab auth lock (Web Locks API) is requested with
// no timeout for getSession() calls, which run on every query. If one tab's
// lock acquisition ever stalls (a frozen/throttled background tab, a dropped
// request mid token-refresh), every other tab sharing this origin — including
// anonymous /live/:matchId viewers — hangs forever waiting for the same lock,
// only resolved by closing the stuck tab. Cap the wait and fall back to
// running without exclusivity instead of hanging indefinitely.
const TAB_LOCK_TIMEOUT_MS = 3000;

async function tabSafeLock<T>(name: string, _acquireTimeout: number, fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return fn();
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), TAB_LOCK_TIMEOUT_MS);

  try {
    return await navigator.locks.request(
      name,
      { mode: 'exclusive', signal: abortController.signal },
      (lock) => (lock ? fn() : fn())
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn(`Supabase auth lock "${name}" timed out after ${TAB_LOCK_TIMEOUT_MS}ms; proceeding without exclusivity.`);
      return fn();
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'tennis-auth',
    flowType: 'pkce',
    lock: tabSafeLock,
  },
  global: {
    headers: {
      'x-application-name': 'tennis-tournament-app',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Auth token refreshed');
  }
  if (event === 'SIGNED_OUT') {
    console.log('User signed out');
  }
  if (!session && event !== 'SIGNED_OUT' && event !== 'INITIAL_SESSION') {
    console.warn('Session lost, clearing storage');
    window.localStorage.removeItem('tennis-auth');
  }
});

export type Category = {
  category: string;
  event: string;
  ranking: string;
  fees: string;
  fees_kid: string;
};

export type Tournament = {
  id: string;
  organizer: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  judge_arbitrator: string | null;
  surface: string | null;
  cash_prize: number;
  prizes_lots: number;
  online_registration: boolean;
  online_payment: boolean;
  event_code: string;
  contact_email: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_postal_code: string | null;
  venue_phone: string | null;
  latitude: number | null;
  longitude: number | null;
  categories: Category[];
  date_ouverture_inscription: string | null;
  status: 'upcoming' | 'ongoing' | 'completed';
  tmc_event: boolean;
  created_at: string;
};

export type UserPlayer = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  license_number: string;
  birth_year: number;
  created_at: string;
  updated_at: string;
};

export type TournamentRegistration = {
  id: string;
  user_id: string;
  tournament_id: string;
  player_id: string;
  registered_at: string;
  created_at: string;
  paid: boolean;
};

export type CustomTournamentEvent = {
  id: string;
  user_id: string;
  player_id: string;
  event_name: string;
  created_at: string;
};

export type Convocation = {
  id: string;
  tournament_id: string | null;
  player_name: string;
  event_code: string;
  convocation_date: string;
  convocation_time: string;
  location: string;
  phone: string;
  judge_arbitrator: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type MatchResult = {
  id: string;
  user_id: string;
  date: string;
  player_name: string;
  tournament_name: string;
  score: string;
  classement: 'NC' | '40' | '30' | '15';
  impressions: {
    forehand: 'bad' | 'good' | 'great';
    backhand: 'bad' | 'good' | 'great';
    serve: 'bad' | 'good' | 'great';
    return: 'bad' | 'good' | 'great';
  };
  scoring_history: any[];
  event_details: string;
  comments: string;
  game_per_set?: 3 | 4 | 6;
  super_tiebreak?: boolean;
  no_ad?: boolean;
  created_at: string;
  updated_at: string;
};

export type Club = {
  id: string;
  club_id: string;
  nom: string;
  ville: string;
  terrain_pratique_libelle: string;
  pratiques: string[];
  lat: number;
  lng: number;
  address?: string;
  website?: string;
  total_courts: number;
  indoor_courts: number;
  tennis_courts: number;
  indoor_tennis_courts: number;
  padel_courts: number;
  indoor_padel_courts: number;
  pickle_courts: number;
  indoor_pickle_courts: number;
  telephone?: string;
  email?: string;
  total_adults?: number;
  total_kids?: number;
  last_modified?: string;
  installations?: any;
  equipes?: any;
  created_at: string;
  updated_at: string;
  calculatedDistance?: number;
  surface?: string;
  courtCount?: number;
};

export type ClubComment = {
  id: string;
  club_id: string;
  user_id: string;
  author_name: string;
  text: string;
  created_at: string;
  updated_at: string;
};

export type TournamentComment = {
  id: string;
  tournament_id: string;
  user_id: string;
  author_name: string;
  text: string;
  created_at: string;
  updated_at: string;
};

export type Tag = {
  id: string;
  name: string;
  created_at: string;
};

export type VideoTag = {
  id: string;
  video_id: string;
  tag_id: string;
  created_at: string;
};
