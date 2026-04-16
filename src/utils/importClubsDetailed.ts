import { supabase } from '../lib/supabase';

interface Surface {
  pratique?: string;
  code: string;
  libelle: string;
  nbTerrains: number;
  nbTerrainsCouverts: number;
}

interface Installation {
  nom?: string;
  address1?: string;
  address2?: string;
  postCode?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  telephone?: string;
  email?: string;
  installationId?: string;
  surfaces?: Surface[];
  equipements?: string[];
  accessibilite?: string[];
}

interface Equipe {
  code?: string;
  description?: string | null;
  membres?: any[];
}

interface ClubData {
  clubID: string;
  clubName: string;
  totalAdults?: number | null;
  totalKids?: number | null;
  lastModified?: string;
  equipes?: Equipe[];
  installations?: Installation[];
}

interface ImportResponse {
  venues: ClubData[];
}

function classifySurface(surface: Surface): 'TENNIS' | 'PADEL' | 'PICKLE' {
  const pratique = (surface.pratique || '').toUpperCase().trim();

  if (pratique.includes('PADEL')) return 'PADEL';
  if (pratique.includes('PICKLEBALL') || pratique.includes('PICKLE')) return 'PICKLE';
  if (pratique === 'TENNIS' || pratique === '') return 'TENNIS';

  const code = (surface.code || '').toUpperCase().trim();
  const libelle = (surface.libelle || '').toUpperCase().trim();

  if (code.includes('PADEL') || libelle.includes('PADEL')) return 'PADEL';
  if (code.includes('PICKLE') || libelle.includes('PICKLE')) return 'PICKLE';

  return 'TENNIS';
}

export async function runClubImport() {
  try {
    const response = await fetch('/code/club/import-club.json');
    if (!response.ok) {
      throw new Error('Failed to fetch club data');
    }

    const data: ImportResponse = await response.json();
    const clubs = data.venues;

    let newClubsCount = 0;
    let updatedClubsCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const club of clubs) {
      try {
        const { data: existingClubs } = await supabase
          .from('clubs')
          .select('id')
          .eq('club_id', club.clubID);

        const isUpdate = existingClubs && existingClubs.length > 0;

        if (isUpdate) {
          const { error: deleteError } = await supabase
            .from('clubs')
            .delete()
            .eq('club_id', club.clubID);

          if (deleteError) {
            throw deleteError;
          }
        }

        const installations = club.installations || [];

        let tennisCourts = 0;
        let indoorTennisCourts = 0;
        let padelCourts = 0;
        let indoorPadelCourts = 0;
        let pickleCourts = 0;
        let indoorPickleCourts = 0;
        let primarySurface = '';
        const installationsData: any[] = [];
        const practiceTypesSet = new Set<string>();

        const firstInstallation = installations[0];

        for (const installation of installations) {
          if (installation.surfaces && installation.surfaces.length > 0) {
            installation.surfaces.forEach(surface => {
              const sport = classifySurface(surface);
              const courts = surface.nbTerrains || 0;
              const indoorCourts = surface.nbTerrainsCouverts || 0;

              switch (sport) {
                case 'TENNIS':
                  tennisCourts += courts;
                  indoorTennisCourts += indoorCourts;
                  practiceTypesSet.add('TENNIS');
                  break;
                case 'PADEL':
                  padelCourts += courts;
                  indoorPadelCourts += indoorCourts;
                  practiceTypesSet.add('PADEL');
                  break;
                case 'PICKLE':
                  pickleCourts += courts;
                  indoorPickleCourts += indoorCourts;
                  practiceTypesSet.add('PICKLEBALL');
                  break;
              }

              if (!primarySurface && surface.libelle && sport === 'TENNIS') {
                primarySurface = surface.libelle;
              }
            });
          }

          installationsData.push({
            nom: installation.nom,
            address1: installation.address1,
            address2: installation.address2,
            postCode: installation.postCode,
            city: installation.city,
            country: installation.country,
            latitude: installation.latitude,
            longitude: installation.longitude,
            telephone: installation.telephone,
            email: installation.email,
            installationId: installation.installationId,
            surfaces: installation.surfaces,
            equipements: installation.equipements,
            accessibilite: installation.accessibilite
          });
        }

        if (tennisCourts > 0) practiceTypesSet.add('TENNIS');
        const practiceTypes = Array.from(practiceTypesSet);

        const totalCourts = tennisCourts + padelCourts + pickleCourts;
        const indoorCourts = indoorTennisCourts + indoorPadelCourts + indoorPickleCourts;

        const allSurfaces: string[] = [];
        installations.forEach(inst => {
          if (inst.surfaces && inst.surfaces.length > 0) {
            inst.surfaces.forEach(s => {
              const sportLabel = s.pratique ? `[${s.pratique}] ` : '';
              allSurfaces.push(`${sportLabel}${s.nbTerrains} ${s.libelle}${s.nbTerrainsCouverts > 0 ? ` (${s.nbTerrainsCouverts} couverts)` : ''}`);
            });
          }
        });
        const terrainLibelles = allSurfaces.join(', ') || null;

        const fullAddress = firstInstallation
          ? [firstInstallation.address1, firstInstallation.postCode, firstInstallation.city].filter(Boolean).join(', ')
          : null;

        const rowToInsert = {
          club_id: club.clubID,
          nom: club.clubName,
          ville: firstInstallation?.city || null,
          terrain_pratique_libelle: terrainLibelles,
          pratiques: practiceTypes,
          lat: firstInstallation?.latitude || null,
          lng: firstInstallation?.longitude || null,
          address: fullAddress || null,
          website: null,
          total_courts: totalCourts,
          indoor_courts: indoorCourts,
          tennis_courts: tennisCourts,
          indoor_tennis_courts: indoorTennisCourts,
          padel_courts: padelCourts,
          indoor_padel_courts: indoorPadelCourts,
          pickle_courts: pickleCourts,
          indoor_pickle_courts: indoorPickleCourts,
          total_adults: club.totalAdults || 0,
          total_kids: club.totalKids || 0,
          last_modified: club.lastModified ? new Date(club.lastModified).toISOString() : null,
          equipes: club.equipes || null,
          installations: installationsData.length > 0 ? installationsData : null,
          telephone: firstInstallation?.telephone || null,
          email: firstInstallation?.email || null,
          surface: primarySurface || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('clubs')
          .insert(rowToInsert);

        if (error) {
          throw error;
        }

        if (isUpdate) {
          updatedClubsCount++;
        } else {
          newClubsCount++;
        }
      } catch (error) {
        errorCount++;
        errors.push(`Club ${club.clubName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`Error importing club ${club.clubName}:`, error);
      }
    }

    return {
      success: true,
      message: `Import completed: ${newClubsCount} new clubs, ${updatedClubsCount} updated, ${errorCount} errors`,
      newClubsCount,
      updatedClubsCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('Club import error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      newClubsCount: 0,
      updatedClubsCount: 0,
      errorCount: 0
    };
  }
}
