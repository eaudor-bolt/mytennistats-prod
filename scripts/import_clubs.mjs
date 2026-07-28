#!/usr/bin/env node
/*
 * Imports/refreshes the `clubs` reference table from public/clubs-full-list.json.
 *
 * This used to run in every visitor's browser via loadAndSeedClubs(), which is
 * why `clubs` carried INSERT/UPDATE grants for anon and authenticated. It is a
 * maintenance job, so it runs here with the service role instead.
 *
 *   export VITE_SUPABASE_URL=https://<project>.supabase.co
 *   export SUPABASE_SERVICE_ROLE_KEY=<service role key>
 *   node scripts/import_clubs.mjs
 *
 * The service role key bypasses RLS. Keep it out of the repo and out of any
 * .env that gets bundled - it is not the anon key.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE = new URL('../public/clubs-full-list.json', import.meta.url);
const BATCH_SIZE = 100;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

function parseCourtInfo(terrainPratiqueLibelle) {
  const result = { total_courts: 0, indoor_courts: 0, padel_courts: 0, pickle_courts: 0 };
  if (!terrainPratiqueLibelle) return result;

  const text = terrainPratiqueLibelle.toLowerCase();

  const tennisMatch = text.match(/tennis\s*:\s*(\d+)\s+terrain/i);
  if (tennisMatch) result.total_courts = parseInt(tennisMatch[1], 10);

  const indoorMatch = text.match(/(\d+)\s+couvert/i);
  if (indoorMatch) result.indoor_courts = parseInt(indoorMatch[1], 10);

  const padelMatch = text.match(/padel\s*:\s*(\d+)/i);
  if (padelMatch) result.padel_courts = parseInt(padelMatch[1], 10);

  const pickleMatch = text.match(/pickleball\s*:\s*(\d+)/i);
  if (pickleMatch) result.pickle_courts = parseInt(pickleMatch[1], 10);

  return result;
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const data = JSON.parse(readFileSync(SOURCE, 'utf8'));

const seen = new Set();
const clubs = data.club_markers
  .filter((club) => {
    if (seen.has(club.clubId)) return false;
    seen.add(club.clubId);
    return club.lat !== 0 && club.lng !== 0 && club.ville;
  })
  .map((club) => {
    const courtInfo = parseCourtInfo(club.terrainPratiqueLibelle || '');
    return {
      club_id: club.clubId,
      nom: club.nom,
      ville: club.ville,
      terrain_pratique_libelle: club.terrainPratiqueLibelle || '',
      pratiques: club.pratiques?.length ? club.pratiques : ['TENNIS'],
      lat: club.lat,
      lng: club.lng,
      ...courtInfo,
    };
  });

console.log(`Importing ${clubs.length} clubs...`);

let imported = 0;
let failed = 0;

for (let i = 0; i < clubs.length; i += BATCH_SIZE) {
  const batch = clubs.slice(i, i + BATCH_SIZE);
  const { error } = await supabase.from('clubs').upsert(batch, { onConflict: 'club_id' });

  if (error) {
    console.error(`Batch at offset ${i} failed:`, error.message);
    failed += batch.length;
  } else {
    imported += batch.length;
  }
}

console.log(`Done: ${imported} imported, ${failed} failed.`);
process.exit(failed ? 1 : 0);
