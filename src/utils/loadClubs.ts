import { supabase } from '../lib/supabase';

const parseCourtCount = (terrainPratiqueLibelle: string): number => {
  if (!terrainPratiqueLibelle) return 0;
  const match = terrainPratiqueLibelle.match(/(\d+)\s+terrain/i);
  return match ? parseInt(match[1], 10) : 1;
};

type CourtInfo = {
  total_courts: number;
  indoor_courts: number;
  padel_courts: number;
  pickle_courts: number;
};

const parseCourtInfo = (terrainPratiqueLibelle: string): CourtInfo => {
  const result: CourtInfo = {
    total_courts: 0,
    indoor_courts: 0,
    padel_courts: 0,
    pickle_courts: 0
  };

  if (!terrainPratiqueLibelle) return result;

  const text = terrainPratiqueLibelle.toLowerCase();

  const tennisMatch = text.match(/tennis\s*:\s*(\d+)\s+terrain/i);
  if (tennisMatch) {
    result.total_courts = parseInt(tennisMatch[1], 10);
  } else {
    const simpleMatch = text.match(/^(\d+)\s+terrain/i);
    if (simpleMatch) {
      result.total_courts = parseInt(simpleMatch[1], 10);
    }
  }

  const indoorMatch = text.match(/dont\s+(\d+)\s+couvert/i);
  if (indoorMatch) {
    result.indoor_courts = parseInt(indoorMatch[1], 10);
  }

  const padelMatch = text.match(/padel\s*:\s*(\d+)/i);
  if (padelMatch) {
    result.padel_courts = parseInt(padelMatch[1], 10);
  }

  const pickleMatch = text.match(/pickleball\s*:\s*(\d+)/i);
  if (pickleMatch) {
    result.pickle_courts = parseInt(pickleMatch[1], 10);
  }

  return result;
};

export async function loadAndSeedClubs() {
  const { count } = await supabase
    .from('clubs')
    .select('*', { count: 'exact', head: true });

  if (count && count > 0) {
    await updateClubsWithDetailedInfo();
    return;
  }

  try {
    const response = await fetch('/clubs-full-list.json');
    const data = await response.json();

    const seenClubIds = new Set<string>();
    const clubsToInsert = data.club_markers
      .filter((club: any) => {
        if (seenClubIds.has(club.clubId)) {
          return false;
        }
        seenClubIds.add(club.clubId);
        return club.lat !== 0 && club.lng !== 0 && club.ville;
      })
      .map((club: any) => {
        const courtInfo = parseCourtInfo(club.terrainPratiqueLibelle || '');
        return {
          club_id: club.clubId,
          nom: club.nom,
          ville: club.ville,
          terrain_pratique_libelle: club.terrainPratiqueLibelle || '',
          pratiques: club.pratiques && club.pratiques.length > 0 ? club.pratiques : ['TENNIS'],
          lat: club.lat,
          lng: club.lng,
          total_courts: courtInfo.total_courts,
          indoor_courts: courtInfo.indoor_courts,
          padel_courts: courtInfo.padel_courts,
          pickle_courts: courtInfo.pickle_courts
        };
      });

    const batchSize = 100;
    for (let i = 0; i < clubsToInsert.length; i += batchSize) {
      const batch = clubsToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from('clubs')
        .upsert(batch, { onConflict: 'club_id' });

      if (error) {
        console.error('Error inserting clubs batch:', error);
      }
    }

    console.log(`Seeded ${clubsToInsert.length} clubs to database`);
  } catch (error) {
    console.error('Error loading clubs:', error);
  }
}

export async function forceImportClubs() {
  try {
    const response = await fetch('/clubs-full-list.json');
    const data = await response.json();

    const seenClubIds = new Set<string>();
    const clubsToUpdate = data.club_markers
      .filter((club: any) => {
        if (seenClubIds.has(club.clubId)) {
          return false;
        }
        seenClubIds.add(club.clubId);
        return club.lat !== 0 && club.lng !== 0 && club.ville;
      })
      .map((club: any) => {
        const courtInfo = parseCourtInfo(club.terrainPratiqueLibelle || '');
        return {
          club_id: club.clubId,
          nom: club.nom,
          ville: club.ville,
          terrain_pratique_libelle: club.terrainPratiqueLibelle || '',
          pratiques: club.pratiques && club.pratiques.length > 0 ? club.pratiques : ['TENNIS'],
          lat: club.lat,
          lng: club.lng,
          total_courts: courtInfo.total_courts,
          indoor_courts: courtInfo.indoor_courts,
          padel_courts: courtInfo.padel_courts,
          pickle_courts: courtInfo.pickle_courts
        };
      });

    const batchSize = 100;
    let successCount = 0;
    for (let i = 0; i < clubsToUpdate.length; i += batchSize) {
      const batch = clubsToUpdate.slice(i, i + batchSize);
      const { error } = await supabase
        .from('clubs')
        .upsert(batch, { onConflict: 'club_id' });

      if (error) {
        console.error('Error updating clubs batch:', error);
      } else {
        successCount += batch.length;
      }
    }

    console.log(`Force imported ${successCount}/${clubsToUpdate.length} clubs`);
    return { success: true, imported: successCount, total: clubsToUpdate.length };
  } catch (error) {
    console.error('Error force importing clubs:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateClubsWithDetailedInfo() {
  try {
    const { data: existingClubs } = await supabase
      .from('clubs')
      .select('club_id, total_courts')
      .limit(1);

    if (existingClubs && existingClubs.length > 0 && existingClubs[0].total_courts !== null && existingClubs[0].total_courts !== 0) {
      console.log('Clubs already have detailed info, skipping update');
      return;
    }

    const response = await fetch('/clubs-full-list.json');
    const data = await response.json();

    const seenClubIds = new Set<string>();
    const clubsToUpdate = data.club_markers
      .filter((club: any) => {
        if (seenClubIds.has(club.clubId)) {
          return false;
        }
        seenClubIds.add(club.clubId);
        return club.lat !== 0 && club.lng !== 0 && club.ville;
      })
      .map((club: any) => {
        const courtInfo = parseCourtInfo(club.terrainPratiqueLibelle || '');
        return {
          club_id: club.clubId,
          nom: club.nom,
          ville: club.ville,
          terrain_pratique_libelle: club.terrainPratiqueLibelle || '',
          pratiques: club.pratiques && club.pratiques.length > 0 ? club.pratiques : ['TENNIS'],
          lat: club.lat,
          lng: club.lng,
          total_courts: courtInfo.total_courts,
          indoor_courts: courtInfo.indoor_courts,
          padel_courts: courtInfo.padel_courts,
          pickle_courts: courtInfo.pickle_courts
        };
      });

    const batchSize = 100;
    for (let i = 0; i < clubsToUpdate.length; i += batchSize) {
      const batch = clubsToUpdate.slice(i, i + batchSize);
      const { error } = await supabase
        .from('clubs')
        .upsert(batch, { onConflict: 'club_id' });

      if (error) {
        console.error('Error updating clubs batch:', error);
      }
    }

    console.log(`Updated ${clubsToUpdate.length} clubs with detailed info`);
  } catch (error) {
    console.error('Error updating clubs with detailed info:', error);
  }
}

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
