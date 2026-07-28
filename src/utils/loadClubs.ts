import { supabase } from '../lib/supabase';

const parseCourtCount = (terrainPratiqueLibelle: string): number => {
  if (!terrainPratiqueLibelle) return 0;
  const match = terrainPratiqueLibelle.match(/(\d+)\s+terrain/i);
  return match ? parseInt(match[1], 10) : 1;
};

/*
 * Seeding and back-filling `clubs` used to happen here, in every visitor's
 * browser. That required INSERT/UPDATE grants on shared reference data for
 * anon and authenticated, which meant any account could rewrite or wipe all
 * 1,412 rows. The table is now read-only from the client; re-importing is a
 * maintenance job run with the service role:
 *
 *   node scripts/import_clubs.mjs
 */

export async function getClubsWithMetadata(userLat?: number, userLng?: number, radiusKm: number = 30) {
  if (!userLat || !userLng) {
    return [];
  }

  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(userLat * Math.PI / 180));

  const { data: clubs, error } = await supabase
    .from('clubs')
    .select('*')
    .gte('lat', userLat - latDelta)
    .lte('lat', userLat + latDelta)
    .gte('lng', userLng - lngDelta)
    .lte('lng', userLng + lngDelta);

  if (error) {
    console.error('Error fetching clubs:', error);
    return [];
  }

  const clubsWithDistance = (clubs || [])
    .map(club => {
      const distance = getDistanceFromLatLonInKm(userLat, userLng, club.lat, club.lng);
      return {
        ...club,
        courtCount: parseCourtCount(club.terrain_pratique_libelle),
        calculatedDistance: distance
      };
    })
    .filter(club => club.calculatedDistance <= radiusKm)
    .sort((a, b) => a.calculatedDistance - b.calculatedDistance);

  return clubsWithDistance;
}

export async function getClubsByBounds(bounds: { north: number; south: number; east: number; west: number }, userLat?: number, userLng?: number) {
  const { data: clubs, error } = await supabase
    .from('clubs')
    .select('*')
    .gte('lat', bounds.south)
    .lte('lat', bounds.north)
    .gte('lng', bounds.west)
    .lte('lng', bounds.east);

  if (error) {
    console.error('Error fetching clubs by bounds:', error);
    return [];
  }

  return (clubs || []).map(club => {
    const distance = userLat && userLng ? getDistanceFromLatLonInKm(userLat, userLng, club.lat, club.lng) : 0;
    return {
      ...club,
      courtCount: parseCourtCount(club.terrain_pratique_libelle),
      calculatedDistance: distance
    };
  }).sort((a, b) => a.calculatedDistance - b.calculatedDistance);
}

export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}
