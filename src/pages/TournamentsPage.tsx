import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, Tournament, TournamentRegistration, Convocation } from '../lib/supabase';
import { TournamentMap } from '../components/TournamentMap';
import { TournamentCalendar } from '../components/TournamentCalendar';
import { TournamentCard } from '../components/TournamentCard';
import { TournamentTable } from '../components/TournamentTable';
import { TournamentModal } from '../components/TournamentModal';
import { ConvocationModal } from '../components/ConvocationModal';
import { TournamentFilter } from '../components/TournamentFilter';
import { TournamentCarousel } from '../components/TournamentCarousel';
import { Pagination } from '../components/Pagination';
import { RegistrationSummary } from '../components/RegistrationSummary';
import { importTournaments } from '../utils/importTournaments';
import { forceImportTournaments } from '../utils/forceImportTournaments';
import { Loader2, Map, Calendar, Menu, X, Lock, Grid2x2 as Grid, List, Trophy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { trackTournamentAction, trackButtonClick, trackFilterAction, trackConvocationAction } from '../utils/analytics';
import { getDistanceFromLatLonInKm } from '../utils/loadClubs';

const ITEMS_PER_PAGE = 50;

export function TournamentsPage() {
  const { t } = useLanguage();
  const { canAccessTournaments, loading: subscriptionLoading } = useSubscription();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [filteredTournaments, setFilteredTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [modalTournament, setModalTournament] = useState<Tournament | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'calendar'>('map');
  const [displayMode, setDisplayMode] = useState<'card' | 'table'>('card');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [registrationVersion, setRegistrationVersion] = useState(0);
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [convocations, setConvocations] = useState<Convocation[]>([]);
  const [isConvocationModalOpen, setIsConvocationModalOpen] = useState(false);
  const [selectedConvocationDate, setSelectedConvocationDate] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number>(() => {
    const saved = localStorage.getItem('tournament_filter_distance');
    return saved ? parseInt(saved) : 50;
  });

  const handleFilterChange = useCallback((filtered: Tournament[]) => {
    setFilteredTournaments(filtered);
    trackFilterAction('tournament_filter', filtered.length, 'tournaments_page');
  }, []);

  useEffect(() => {
    initializeTournaments();
    getUserLocation();
    (window as any).reimportTournaments = async () => {
      await forceImportTournaments();
      await fetchTournaments();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('tournament_filter_distance', distance.toString());
  }, [distance]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          setUserLocation({ lat: 48.8566, lng: 2.3522 });
        },
        { timeout: 10000, maximumAge: 600000 }
      );
    } else {
      setUserLocation({ lat: 48.8566, lng: 2.3522 });
    }
  };

  const tournamentsWithDistance = useMemo(() => {
    return tournaments.map(t => {
      if (!userLocation || !t.latitude || !t.longitude) return { ...t, calculatedDistance: undefined };
      const dist = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, Number(t.latitude), Number(t.longitude));
      return { ...t, calculatedDistance: dist };
    });
  }, [tournaments, userLocation]);

  const initializeTournaments = async () => {
    setLoading(true);

    const { count } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true });

    if (count === 0) {
      await importTournaments();
    }

    await fetchTournaments();
  };

  const fetchTournaments = async () => {
    let allTournaments: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_date', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Error fetching tournaments:', error);
        break;
      }

      if (data && data.length > 0) {
        allTournaments = [...allTournaments, ...data];
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    setTournaments(allTournaments);
    setFilteredTournaments(allTournaments);

    await fetchRegistrations();
    await fetchConvocations();
    setLoading(false);
  };

  const fetchRegistrations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching registrations:', error);
    } else {
      setRegistrations(data || []);
    }
  };

  const fetchConvocations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('convocations')
      .select('*')
      .eq('user_id', user.id)
      .order('convocation_date', { ascending: true });

    if (error) {
      console.error('Error fetching convocations:', error);
    } else {
      setConvocations(data || []);
    }
  };

  const totalPages = Math.ceil(filteredTournaments.length / ITEMS_PER_PAGE);
  const paginatedTournaments = filteredTournaments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredTournaments.length]);

  if (subscriptionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#050d1a]">
        <Loader2 className="w-12 h-12 text-[#C8F135] animate-spin" />
      </div>
    );
  }

  if (!canAccessTournaments) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 bg-gradient-to-br from-[#050d1a] via-[#071428] to-[#050d1a] min-h-screen">
        <div className="bg-white/5 backdrop-blur-md rounded-xl shadow-2xl shadow-black/40 border border-white/10 p-12 text-center">
          <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">
            Tournaments Access Restricted
          </h2>
          <p className="text-gray-300 mb-6">
            This feature is currently in beta and available to selected users only.
          </p>
          <p className="text-sm text-gray-400">
            Contact support if you believe you should have access to this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050d1a] via-[#071428] to-[#050d1a] relative overflow-x-hidden w-full max-w-full">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1A6FC4]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#C8F135]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-full mx-auto px-3 sm:px-4 lg:px-10 pt-16 pb-4 lg:pt-20 lg:pb-8 relative overflow-x-hidden box-border">
        {/* Page Header */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-3 lg:px-10 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="w-5 h-5 text-[#C8F135]" />
            <span className="text-[#C8F135] text-sm font-medium tracking-widest uppercase">
              Tournaments
            </span>
          </div>
          <h1 className="text-4xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6">
            Discover<br />
            <span className="text-[#C8F135]">Tournaments</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl leading-relaxed">
            {t('tournaments.subtitle')}
          </p>
        </div>

        {/* Registration Summary */}
        <RegistrationSummary
          tournaments={tournaments}
          convocations={convocations}
          onConvocationClick={(tournament) => {
            setModalTournament(tournament);
            setIsModalOpen(true);
          }}
          onRefresh={async () => {
            await fetchRegistrations();
            await fetchConvocations();
            setRegistrationVersion(v => v + 1);
          }}
        />

        {/* Information Banner */}
        <div className="mb-4 mx-3 lg:mx-0 bg-gray-100/10 border border-gray-400/20 rounded-lg p-3 flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            <strong>Note:</strong> The database is not exhaustive (it does not contain all tournaments) and may not be fully accurate. Always check the official tournament sources in your local country.
          </p>
        </div>

        {/* Desktop Layout: Filter + Map/Calendar */}
        <div className="hidden lg:grid lg:grid-cols-4 gap-4 mb-4 px-3 lg:px-0">
          {/* Filter Sidebar */}
          <div className="lg:col-span-1">
            <TournamentFilter
              tournaments={tournamentsWithDistance}
              onFilterChange={handleFilterChange}
              filteredCount={filteredTournaments.length}
              distance={distance}
              onDistanceChange={setDistance}
              userLocation={userLocation}
            />
          </div>

          {/* Map/Calendar */}
          <div className="lg:col-span-3">
            <div className="mb-3 flex justify-center gap-2">
              <button
                onClick={() => {
                  setViewMode('map');
                  trackButtonClick('view_mode_map', 'tournaments_page');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'map'
                    ? 'bg-[#C8F135] text-[#050d1a] shadow-lg shadow-[#C8F135]/20'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                <Map className="w-4 h-4" />
               {t('tournaments.map')}
              </button>
              <button
                onClick={() => {
                  setViewMode('calendar');
                  trackButtonClick('view_mode_calendar', 'tournaments_page');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-[#C8F135] text-[#050d1a] shadow-lg shadow-[#C8F135]/20'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                <Calendar className="w-4 h-4" />
                {t('tournaments.calendar')}
              </button>
            </div>

            <div className="h-[600px] w-full max-w-full overflow-hidden rounded-lg">
              {viewMode === 'map' ? (
                <TournamentMap
                  tournaments={filteredTournaments}
                  selectedTournament={selectedTournamentId}
                  onSelectTournament={setSelectedTournamentId}
                  registrations={registrations}
                  userLocation={userLocation}
                  onOpenTournamentModal={(tournament) => {
                    trackTournamentAction('view', tournament.id);
                    setModalTournament(tournament);
                    setIsModalOpen(true);
                  }}
                />
              ) : (
                <TournamentCalendar
                  tournaments={filteredTournaments}
                  convocations={convocations}
                  onSelectTournament={setSelectedTournamentId}
                  onOpenTournamentModal={(tournament) => {
                    trackTournamentAction('view', tournament.id);
                    setModalTournament(tournament);
                    setIsModalOpen(true);
                  }}
                  onOpenConvocationModal={(date) => {
                    setSelectedConvocationDate(date);
                    setIsConvocationModalOpen(true);
                    trackButtonClick('add_convocation', 'tournaments_page');
                  }}
                  registrationVersion={registrationVersion}
                />
              )}
            </div>
          </div>
        </div>
 {/* Mobile Header with Burger Menu */}
      <div className="lg:hidden sticky top-0 z-30 bg-[#0a1526]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 shadow-lg overflow-x-hidden">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition text-white"
          >
            {isFilterOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h2 className="text-lg font-bold text-white">{t('tournaments.headtitle')}</h2>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Mobile Filter Overlay */}
      {isFilterOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)}>
          <div className="bg-[#0a1526] h-full w-80 max-w-[90vw] overflow-y-auto border-r border-white/10 overflow-x-hidden" onClick={(e) => e.stopPropagation()}>
            <TournamentFilter
              tournaments={tournamentsWithDistance}
              onFilterChange={handleFilterChange}
              isOpen={true}
              onClose={() => setIsFilterOpen(false)}
              filteredCount={filteredTournaments.length}
              distance={distance}
              onDistanceChange={setDistance}
              userLocation={userLocation}
            />
          </div>
        </div>
      )}
        {/* Mobile View Mode Toggle */}
        <div className="lg:hidden mb-3 px-3">
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'map'
                  ? 'bg-[#C8F135] text-[#050d1a] shadow-lg shadow-[#C8F135]/20'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
              }`}
            >
              <Map className="w-4 h-4" />
              {t('tournaments.map')}
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'calendar'
                  ? 'bg-[#C8F135] text-[#050d1a] shadow-lg shadow-[#C8F135]/20'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
              }`}
            >
              <Calendar className="w-4 h-4" />
              {t('tournaments.calendar')}
            </button>
          </div>
        </div>

        {/* Mobile Map/Calendar */}
        <div className="lg:hidden mb-4 px-3">
          <div className="h-[400px] w-full max-w-full overflow-hidden rounded-lg">
            {viewMode === 'map' ? (
              <TournamentMap
                tournaments={filteredTournaments}
                selectedTournament={selectedTournamentId}
                onSelectTournament={setSelectedTournamentId}
                registrations={registrations}
                userLocation={userLocation}
                onOpenTournamentModal={(tournament) => {
                  setModalTournament(tournament);
                  setIsModalOpen(true);
                }}
              />
            ) : (
              <TournamentCalendar
                tournaments={filteredTournaments}
                convocations={convocations}
                onSelectTournament={setSelectedTournamentId}
                onOpenTournamentModal={(tournament) => {
                  setModalTournament(tournament);
                  setIsModalOpen(true);
                }}
                onOpenConvocationModal={(date) => {
                  setSelectedConvocationDate(date);
                  setIsConvocationModalOpen(true);
                }}
                registrationVersion={registrationVersion}
              />
            )}
          </div>
        </div>

        {/* Mobile Tournament List */}
        <div className="lg:hidden mb-4 px-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              Tournaments ({filteredTournaments.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDisplayMode('card');
                  trackButtonClick('display_mode_card', 'tournaments_page');
                }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  displayMode === 'card'
                    ? 'bg-[#C8F135] text-[#050d1a] shadow-lg shadow-[#C8F135]/20'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                <Grid className="w-3 h-3" />
                Cards
              </button>
              <button
                onClick={() => {
                  setDisplayMode('table');
                  trackButtonClick('display_mode_table', 'tournaments_page');
                }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  displayMode === 'table'
                    ? 'bg-[#C8F135] text-[#050d1a] shadow-lg shadow-[#C8F135]/20'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                <List className="w-3 h-3" />
                Table
              </button>
            </div>
          </div>

          {filteredTournaments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No tournaments found</p>
            </div>
          ) : (
            <>
              {displayMode === 'card' ? (
                <TournamentCarousel
                  tournaments={filteredTournaments}
                  selectedTournamentId={selectedTournamentId}
                  onSelectTournament={setSelectedTournamentId}
                  onRegistrationChange={() => setRegistrationVersion(v => v + 1)}
                />
              ) : (
                <TournamentTable
                  tournaments={paginatedTournaments}
                  onTournamentClick={(tournament) => {
                    const lat = Number(tournament.latitude);
                    const lng = Number(tournament.longitude);

                    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                      setSelectedTournamentId(tournament.id);
                    }

                    setModalTournament(tournament);
                    setIsModalOpen(true);
                  }}
                  onRegistrationChange={() => setRegistrationVersion(v => v + 1)}
                />
              )}

              {displayMode === 'table' && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          )}
        </div>

        {/* Desktop: Tournament List */}
        <div className="hidden lg:block px-3 lg:px-0">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">
              {t('tournaments.allTournaments')} ({filteredTournaments.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDisplayMode('card');
                  trackButtonClick('display_mode_card', 'tournaments_page');
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  displayMode === 'card'
                    ? 'bg-[#C8F135] text-[#050d1a] shadow-lg shadow-[#C8F135]/20'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                <Grid className="w-4 h-4" />
                Cards
              </button>
              <button
                onClick={() => {
                  setDisplayMode('table');
                  trackButtonClick('display_mode_table', 'tournaments_page');
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  displayMode === 'table'
                    ? 'bg-[#C8F135] text-[#050d1a] shadow-lg shadow-[#C8F135]/20'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                <List className="w-4 h-4" />
                Table
              </button>
            </div>
          </div>

          {filteredTournaments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">{t('tournaments.noResults')}</p>
            </div>
          ) : (
            <>
              {displayMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginatedTournaments.map((tournament) => (
                    <TournamentCard
                      key={tournament.id}
                      tournament={tournament}
                      isSelected={selectedTournamentId === tournament.id}
                      onClick={() => {
                        const lat = Number(tournament.latitude);
                        const lng = Number(tournament.longitude);

                        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                          setSelectedTournamentId(tournament.id);
                        }

                        setModalTournament(tournament);
                        setIsModalOpen(true);
                      }}
                      onRegistrationChange={() => setRegistrationVersion(v => v + 1)}
                    />
                  ))}
                </div>
              ) : (
                <TournamentTable
                  tournaments={paginatedTournaments}
                  onTournamentClick={(tournament) => {
                    const lat = Number(tournament.latitude);
                    const lng = Number(tournament.longitude);

                    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                      setSelectedTournamentId(tournament.id);
                    }

                    setModalTournament(tournament);
                    setIsModalOpen(true);
                  }}
                  onRegistrationChange={() => setRegistrationVersion(v => v + 1)}
                />
              )}

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>

      <TournamentModal
        tournament={modalTournament}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalTournament(null);
        }}
        onRegistrationChange={() => setRegistrationVersion(v => v + 1)}
      />

      <ConvocationModal
        isOpen={isConvocationModalOpen}
        onClose={() => {
          setIsConvocationModalOpen(false);
          setSelectedConvocationDate('');
        }}
        selectedDate={selectedConvocationDate}
        tournaments={tournaments}
        registrations={registrations}
        onConvocationCreated={async () => {
          await fetchConvocations();
          setRegistrationVersion(v => v + 1);
        }}
      />
    </div>
  );
}
