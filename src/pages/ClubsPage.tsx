import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Club, supabase } from '../lib/supabase';
import { ClubMapView } from '../components/ClubMapView';
import { ClubList } from '../components/ClubList';
import { getClubsWithMetadata, getClubsByBounds } from '../utils/loadClubs';
import { trackClubAction } from '../utils/analytics';
import { useAlert } from '../hooks/useAlert';
import { useLanguage } from '../contexts/LanguageContext';

type FilterState = {
  minCourts: number;
  surface: string | 'All';
  distance: number;
  clubName: string;
  indoorOnly: boolean;
  pickleballOnly: boolean;
  padelOnly: boolean;
  interestedOnly: boolean;
};

export function ClubsPage() {
  const { t } = useLanguage();
  const { showAlert, AlertComponent } = useAlert();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialCenter, setInitialCenter] = useState<[number, number] | undefined>(undefined);
  const [interestedClubIds, setInterestedClubIds] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [filters, setFilters] = useState<FilterState>({
    minCourts: 0,
    surface: 'All',
    distance: 30,
    clubName: '',
    indoorOnly: false,
    pickleballOnly: false,
    padelOnly: false,
    interestedOnly: false,
  });

  useEffect(() => {
    initializeApp();
    loadInterestedClubs();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const initializeApp = async () => {
    setLoading(true);
    getUserLocation();
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setInitialCenter([location.lat, location.lng]);
          setLoading(false);
        },
        (error) => {
          console.error("Error getting location, using Paris as fallback", error);
          const fallback = { lat: 48.8566, lng: 2.3522 };
          setUserLocation(fallback);
          setInitialCenter([fallback.lat, fallback.lng]);
          setLoading(false);
        },
        {
          timeout: 10000,
          maximumAge: 600000
        }
      );
    } else {
      console.log("Geolocation not supported, using Paris as fallback");
      const fallback = { lat: 48.8566, lng: 2.3522 };
      setUserLocation(fallback);
      setInitialCenter([fallback.lat, fallback.lng]);
      setLoading(false);
    }
  };

  const loadInterestedClubs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_interested_clubs')
      .select('club_id')
      .eq('user_id', user.id);

    if (data) {
      setInterestedClubIds(new Set(data.map(item => item.club_id)));
    }
  };

  const handleInterestedChange = async (clubId: string, isInterested: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showAlert(t('clubs.page.mustBeLoggedIn'), { type: 'warning' });
      return;
    }

    if (isInterested) {
      const { error } = await supabase
        .from('user_interested_clubs')
        .insert({ user_id: user.id, club_id: clubId });

      if (!error) {
        setInterestedClubIds(prev => new Set([...prev, clubId]));
      }
    } else {
      const { error } = await supabase
        .from('user_interested_clubs')
        .delete()
        .eq('user_id', user.id)
        .eq('club_id', clubId);

      if (!error) {
        setInterestedClubIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(clubId);
          return newSet;
        });
      }
    }
  };

  const handleMapBoundsChange = async (bounds: { north: number; south: number; east: number; west: number }) => {
    const clubsData = await getClubsByBounds(bounds, userLocation?.lat, userLocation?.lng);
    setClubs(clubsData);
  };

  const filteredClubs = useMemo(() => {
    let result = [...clubs];

    if (filters.clubName.trim()) {
      const searchTerm = filters.clubName.toLowerCase().trim();
      result = result.filter(club => {
        if (club.nom.toLowerCase().includes(searchTerm)) return true;
        if (club.ville.toLowerCase().includes(searchTerm)) return true;
        if (club.address?.toLowerCase().includes(searchTerm)) return true;

        if (club.equipes && Array.isArray(club.equipes)) {
          for (const equipe of club.equipes) {
            if ((equipe as any).code === 'dirigeante' || (equipe as any).code === 'pedagogique') {
              const membres = (equipe as any).membres;
              if (Array.isArray(membres)) {
                for (const membre of membres) {
                  const fullName = `${membre.prenom || ''} ${membre.nom || ''}`.toLowerCase();
                  if (fullName.includes(searchTerm)) return true;
                }
              }
            }
          }
        }

        return false;
      });
    }

    if (filters.surface !== 'All') {
      result = result.filter(club => club.surface === filters.surface);
    }

    if (filters.minCourts > 0) {
      result = result.filter(club => (club.total_courts || 0) >= filters.minCourts);
    }

    if (filters.indoorOnly) {
      result = result.filter(club => (club.indoor_courts || 0) > 0);
    }

    if (filters.pickleballOnly) {
      result = result.filter(club => (club.pickle_courts || 0) > 0);
    }

    if (filters.padelOnly) {
      result = result.filter(club => (club.padel_courts || 0) > 0);
    }

    if (filters.interestedOnly) {
      result = result.filter(club => interestedClubIds.has(club.club_id));
    }

    return result;
  }, [clubs, filters, interestedClubIds]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-[#050d1a]">
        <Loader2 className="w-12 h-12 text-[#C8F135] animate-spin" />
        <p className="text-gray-300">{t('clubs.page.loadingNearby')}</p>
      </div>
    );
  }


  const showMap = !isMobile || !selectedClub;

  return (
    <>
      <AlertComponent />
      <div className="min-h-screen bg-[#050d1a]">
        {/* Hero Section */}
        <section className="relative pt-16 pb-8 lg:pt-20 lg:pb-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#050d1a] via-[#071428]/30 to-[#050d1a]" />

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[600px] h-[300px] bg-[#1A6FC4]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[400px] bg-[#C8F135]/5 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
            <div className="flex items-center gap-2 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin w-5 h-5 text-[#C8F135]"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span className="text-[#C8F135] text-sm font-medium tracking-widest uppercase">
                {t('clubs.page.hero.eyebrow')}
              </span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6">
              {t('clubs.page.hero.title1')}<br />
              <span className="text-[#C8F135]">{t('clubs.page.hero.title2')}</span>
            </h1>

            <p className="text-lg text-gray-300 max-w-2xl leading-relaxed">
              {t('clubs.page.hero.subtitle')}
            </p>
          </div>
        </section>

        <div className={`flex w-full bg-gradient-to-br from-[#050d1a] via-[#071428] to-[#050d1a] flex-col md:flex-row ${isMobile ? 'h-[100dvh]' : 'h-[calc(100vh-64px)]'} overflow-hidden relative`}>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1A6FC4]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#C8F135]/5 rounded-full blur-3xl" />
          </div>

      {showMap && (
        <div className={`${selectedClub ? 'h-[30vh]' : 'h-[40vh]'} md:h-full md:flex-[2] relative flex-shrink-0 rounded-lg md:rounded-none overflow-hidden md:m-0 m-2 shadow-2xl shadow-black/40 border border-white/5`}>
          <ClubMapView
            clubs={filteredClubs}
            selectedClub={selectedClub}
            onSelectClub={(club) => {
              if (club) {
                trackClubAction('view', club.id);
              }
              setSelectedClub(club);
            }}
            userLocation={userLocation}
            onBoundsChange={handleMapBoundsChange}
            initialCenter={initialCenter}
            interestedClubIds={interestedClubIds}
          />
        </div>
      )}

      <div className={`${
        isMobile && selectedClub
          ? 'flex-1'
          : selectedClub
          ? 'flex-1 md:h-full md:w-[400px] md:flex-none'
          : 'flex-1 md:h-full md:w-[400px] md:flex-none'
      } bg-[#0a1526]/80 backdrop-blur-md shadow-2xl shadow-black/50 z-10 border-l border-white/10 overflow-hidden relative`}>
        <ClubList
          clubs={filteredClubs}
          selectedClub={selectedClub}
          onSelectClub={(club) => {
            if (club) {
              trackClubAction('view', club.id);
            }
            setSelectedClub(club);
          }}
          filters={filters}
          setFilters={setFilters}
          userLocation={userLocation}
          interestedClubIds={interestedClubIds}
          onInterestedChange={handleInterestedChange}
        />
      </div>
        </div>
      </div>
    </>
  );
}
