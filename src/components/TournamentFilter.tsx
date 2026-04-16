import { useState, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Tournament, UserPlayer } from '../lib/supabase';
import { usePlayers } from '../contexts/PlayersContext';
import { useTournamentData } from '../contexts/TournamentDataContext';
import categoryMappings from '../data/categories.json';
import { trackFilterAction } from '../utils/analytics';

type TournamentWithDistance = Tournament & { calculatedDistance?: number };

type TournamentFilterProps = {
  tournaments: TournamentWithDistance[];
  onFilterChange: (filtered: TournamentWithDistance[]) => void;
  isOpen?: boolean;
  onClose?: () => void;
  filteredCount?: number;
  distance?: number;
  onDistanceChange?: (distance: number) => void;
  userLocation?: { lat: number; lng: number } | null;
};

export function TournamentFilter({ tournaments, onFilterChange, isOpen = true, onClose, filteredCount, distance = 0, onDistanceChange, userLocation }: TournamentFilterProps) {
  const { players } = usePlayers();
  const { registrations } = useTournamentData();

  const [searchTerm, setSearchTerm] = useState(() => {
    const saved = localStorage.getItem('tournament_filter_search');
    return saved || '';
  });

  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('tournament_filter_categories');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedSurfaces, setSelectedSurfaces] = useState<string[]>(() => {
    const saved = localStorage.getItem('tournament_filter_surfaces');
    return saved ? JSON.parse(saved) : [];
  });

  const [statusFilter, setStatusFilter] = useState<string[]>(() => {
    const saved = localStorage.getItem('tournament_filter_status');
    return saved ? JSON.parse(saved) : ['upcoming', 'ongoing'];
  });

  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(() => {
    const saved = localStorage.getItem('tournament_filter_players');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedEpreuve, setSelectedEpreuve] = useState(() => {
    const saved = localStorage.getItem('tournament_filter_epreuve');
    return saved || '';
  });

  const [startDate, setStartDate] = useState(() => {
    const saved = localStorage.getItem('tournament_filter_startDate');
    return saved || '';
  });

  const [endDate, setEndDate] = useState(() => {
    const saved = localStorage.getItem('tournament_filter_endDate');
    return saved || '';
  });

  const [selectedProfilePlayer, setSelectedProfilePlayer] = useState<string>(() => {
    const saved = localStorage.getItem('tournament_filter_profile_player');
    return saved || '';
  });

  const [tmcOnly, setTmcOnly] = useState(() => {
    const saved = localStorage.getItem('tournament_filter_tmc');
    return saved === 'true';
  });

  const [inscriptionOuverte, setInscriptionOuverte] = useState(() => {
    const saved = localStorage.getItem('tournament_filter_inscription_ouverte');
    return saved === 'true';
  });

  const registeredTournamentIds = useMemo(
    () => new Set(registrations.filter(r => r && r.tournament_id).map(r => r.tournament_id)),
    [registrations]
  );

  const playerTournamentMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    registrations.forEach(reg => {
      if (reg && reg.player_id && reg.tournament_id) {
        if (!map.has(reg.player_id)) {
          map.set(reg.player_id, new Set());
        }
        map.get(reg.player_id)!.add(reg.tournament_id);
      }
    });
    return map;
  }, [registrations]);

  const keyCategories = useMemo(() => {
    return Object.keys(categoryMappings);
  }, []);

  const allSurfaces = useMemo(() => {
    return Array.from(
      new Set(tournaments.map(t => t.surface).filter(Boolean))
    ).filter(Boolean).sort();
  }, [tournaments]);

  const allEpreuves = useMemo(() => {
    return Array.from(
      new Set(
        tournaments.flatMap(t =>
          t.categories?.map(c => c.event).filter(Boolean) || []
        )
      )
    ).filter(Boolean).sort();
  }, [tournaments]);

  const categoryOrder = useMemo(() => [
    '7 à 10 ans',
    '11 ans',
    '11/12 ans',
    '12 ans',
    '13 ans',
    '13/14 ans',
    '14 ans',
    '15/16 ans',
    '17/18 ans',
    'Senior',
    '35 ans',
    '40 ans',
    '45 ans',
    '50 ans',
    '55 ans',
    '60 ans',
    '65 ans',
    '70 ans',
    '75 ans',
    '80 ans',
  ], []);

  const sortedCategories = useMemo(() => {
    return [...keyCategories].sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [keyCategories, categoryOrder]);

  useEffect(() => {
    localStorage.setItem('tournament_filter_search', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('tournament_filter_categories', JSON.stringify(selectedCategories));
  }, [selectedCategories]);

  useEffect(() => {
    localStorage.setItem('tournament_filter_surfaces', JSON.stringify(selectedSurfaces));
  }, [selectedSurfaces]);

  useEffect(() => {
    localStorage.setItem('tournament_filter_status', JSON.stringify(statusFilter));
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem('tournament_filter_players', JSON.stringify(selectedPlayers));
  }, [selectedPlayers]);

  useEffect(() => {
    localStorage.setItem('tournament_filter_epreuve', selectedEpreuve);
  }, [selectedEpreuve]);

  useEffect(() => {
    localStorage.setItem('tournament_filter_startDate', startDate);
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem('tournament_filter_endDate', endDate);
  }, [endDate]);

  useEffect(() => {
    localStorage.setItem('tournament_filter_profile_player', selectedProfilePlayer);
  }, [selectedProfilePlayer]);

  useEffect(() => {
    localStorage.setItem('tournament_filter_tmc', tmcOnly.toString());
  }, [tmcOnly]);

  useEffect(() => {
    localStorage.setItem('tournament_filter_inscription_ouverte', inscriptionOuverte.toString());
  }, [inscriptionOuverte]);

  useEffect(() => {
    const filtered = tournaments.filter(tournament => {
      if (!tournament || !tournament.id) return false;

      const matchesSearch =
        (tournament.organizer?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (tournament.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (tournament.venue_city?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategories.length === 0 ||
        tournament.categories?.some(c => {
          if (!c || !c.category) return false;
          return selectedCategories.some(keyCategory => {
            const subcategories = categoryMappings[keyCategory as keyof typeof categoryMappings] || [];
            return subcategories.includes(c.category);
          });
        });

      const matchesSurface = selectedSurfaces.length === 0 ||
        (tournament.surface && selectedSurfaces.includes(tournament.surface));

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const tournamentStart = new Date(tournament.start_date);
      tournamentStart.setHours(0, 0, 0, 0);
      const tournamentEnd = new Date(tournament.end_date);
      tournamentEnd.setHours(23, 59, 59, 999);
      const isRegistered = registeredTournamentIds.has(tournament.id);

      let matchesStatus = true;
      if (statusFilter.includes('all')) {
        matchesStatus = true;
      } else {
        const matchesUpcoming = statusFilter.includes('upcoming') && tournamentEnd > now;
        const matchesOngoing = statusFilter.includes('ongoing') && tournamentStart <= now && tournamentEnd >= now;
        const matchesCompleted = statusFilter.includes('completed') && tournamentEnd < now;
        matchesStatus = matchesUpcoming || matchesOngoing || matchesCompleted;
      }

      const matchesPlayer = selectedPlayers.length === 0 ||
        selectedPlayers.some(playerId =>
          playerTournamentMap.get(playerId)?.has(tournament.id)
        );

      const matchesEpreuve = !selectedEpreuve ||
        tournament.categories?.some(c => c && c.event === selectedEpreuve);

      const matchesStartDate = !startDate ||
        new Date(tournament.start_date) >= new Date(startDate);

      const matchesEndDate = !endDate ||
        new Date(tournament.end_date) <= new Date(endDate);

      const matchesTmc = !tmcOnly || (tournament.tmc_event === true);

      let matchesInscriptionOuverte = true;
      if (inscriptionOuverte && tournament.date_ouverture_inscription) {
        const ouvertureDate = new Date(tournament.date_ouverture_inscription);
        ouvertureDate.setHours(0, 0, 0, 0);
        matchesInscriptionOuverte = ouvertureDate <= now;
      }

      const matchesDistance = !userLocation || distance === 0 ||
        ((tournament as TournamentWithDistance).calculatedDistance !== undefined &&
         (tournament as TournamentWithDistance).calculatedDistance! <= distance);

      const passes = matchesSearch && matchesCategory && matchesSurface && matchesStatus && matchesPlayer && matchesEpreuve && matchesStartDate && matchesEndDate && matchesTmc && matchesInscriptionOuverte && matchesDistance;

      return passes;
    });
    onFilterChange(filtered);
  }, [searchTerm, selectedCategories, selectedSurfaces, statusFilter, selectedPlayers, selectedEpreuve, startDate, endDate, tmcOnly, inscriptionOuverte, tournaments, registeredTournamentIds, playerTournamentMap, onFilterChange, distance, userLocation]);

  const toggleCategory = (category: string) => {
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    setSelectedCategories(newCategories);
    trackFilterAction('category', category, 'tournament_filter');
  };

  const toggleSurface = (surface: string) => {
    const newSurfaces = selectedSurfaces.includes(surface)
      ? selectedSurfaces.filter(s => s !== surface)
      : [...selectedSurfaces, surface];
    setSelectedSurfaces(newSurfaces);
    trackFilterAction('surface', surface, 'tournament_filter');
  };

  const toggleStatus = (status: string) => {
    if (status === 'all') {
      setStatusFilter(['all']);
      trackFilterAction('status', 'all', 'tournament_filter');
    } else {
      setStatusFilter(prev => {
        const filtered = prev.filter(s => s !== 'all');
        const newFilter = filtered.includes(status)
          ? filtered.filter(s => s !== status)
          : [...filtered, status];

        if (newFilter.length === 0) {
          return ['upcoming', 'ongoing'];
        }
        trackFilterAction('status', status, 'tournament_filter');
        return newFilter;
      });
    }
  };

  const togglePlayer = (playerId: string) => {
    const newPlayers = selectedPlayers.includes(playerId)
      ? selectedPlayers.filter(p => p !== playerId)
      : [...selectedPlayers, playerId];
    setSelectedPlayers(newPlayers);
    trackFilterAction('player', playerId, 'tournament_filter');
  };

  const getCategoryForAge = (age: number): string[] => {
    const matchingCategories: string[] = [];

    // Ages 7-10
    if (age >= 7 && age <= 10) {
      matchingCategories.push('7 à 10 ans');
    }

    // Age 11
    if (age === 11) {
      matchingCategories.push('11 ans', '11/12 ans');
    }

    // Age 12
    if (age === 12) {
      matchingCategories.push('12 ans', '11/12 ans');
    }

    // Age 13
    if (age === 13) {
      matchingCategories.push('13 ans', '13/14 ans');
    }

    // Age 14
    if (age === 14) {
      matchingCategories.push('14 ans', '13/14 ans');
    }

    // Ages 15-16
    if (age === 15 || age === 16) {
      matchingCategories.push('15/16 ans');
    }

    // Ages 17-18
    if (age === 17 || age === 18) {
      matchingCategories.push('17/18 ans');
    }

    // Senior (19-34) and age-based categories
    if (age >= 19 && age <= 34) {
      matchingCategories.push('Senior');
    }

    // 35 ans and above
    if (age >= 35 && age <= 39) {
      matchingCategories.push('Senior', '35 ans');
    }

    if (age >= 40 && age <= 44) {
      matchingCategories.push('Senior', '35 ans', '40 ans');
    }

    if (age >= 45 && age <= 49) {
      matchingCategories.push('Senior', '35 ans', '40 ans', '45 ans');
    }

    if (age >= 50 && age <= 54) {
      matchingCategories.push('Senior', '35 ans', '40 ans', '45 ans', '50 ans');
    }

    if (age >= 55 && age <= 59) {
      matchingCategories.push('Senior', '35 ans', '40 ans', '45 ans', '50 ans', '55 ans');
    }

    if (age >= 60 && age <= 64) {
      matchingCategories.push('Senior', '35 ans', '40 ans', '45 ans', '50 ans', '55 ans', '60 ans');
    }

    if (age >= 65 && age <= 69) {
      matchingCategories.push('Senior', '35 ans', '40 ans', '45 ans', '50 ans', '55 ans', '60 ans', '65 ans');
    }

    if (age >= 70 && age <= 74) {
      matchingCategories.push('Senior', '35 ans', '40 ans', '45 ans', '50 ans', '55 ans', '60 ans', '65 ans', '70 ans');
    }

    if (age >= 75 && age <= 79) {
      matchingCategories.push('Senior', '35 ans', '40 ans', '45 ans', '50 ans', '55 ans', '60 ans', '65 ans', '70 ans', '75 ans');
    }

    if (age >= 80) {
      matchingCategories.push('Senior', '35 ans', '40 ans', '45 ans', '50 ans', '55 ans', '60 ans', '65 ans', '70 ans', '75 ans', '80 ans');
    }

    return matchingCategories.filter(cat => keyCategories.includes(cat));
  };

  const selectProfilePlayer = (playerId: string) => {
    if (selectedProfilePlayer === playerId) {
      setSelectedProfilePlayer('');
      setSelectedCategories([]);
      return;
    }

    setSelectedProfilePlayer(playerId);

    const player = players.find(p => p.id === playerId);
    if (player && player.birth_year) {
      const currentYear = new Date().getFullYear();
      const age = currentYear - player.birth_year;
      const matchingCategories = getCategoryForAge(age);

      if (matchingCategories.length > 0) {
        setSelectedCategories(matchingCategories);
      }
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategories([]);
    setSelectedSurfaces([]);
    setStatusFilter(['upcoming', 'ongoing']);
    setSelectedPlayers([]);
    setSelectedEpreuve('');
    setStartDate('');
    setEndDate('');
    setSelectedProfilePlayer('');
    setTmcOnly(false);
    setInscriptionOuverte(false);
    if (onDistanceChange) onDistanceChange(50);

    localStorage.removeItem('tournament_filter_search');
    localStorage.removeItem('tournament_filter_categories');
    localStorage.removeItem('tournament_filter_surfaces');
    localStorage.removeItem('tournament_filter_status');
    localStorage.removeItem('tournament_filter_players');
    localStorage.removeItem('tournament_filter_epreuve');
    localStorage.removeItem('tournament_filter_startDate');
    localStorage.removeItem('tournament_filter_endDate');
    localStorage.removeItem('tournament_filter_profile_player');
    localStorage.removeItem('tournament_filter_tmc');
    localStorage.removeItem('tournament_filter_inscription_ouverte');
    localStorage.removeItem('tournament_filter_distance');
  };

  if (!isOpen) return null;

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden h-[600px] flex flex-col">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white">Filters</h3>
          {filteredCount !== undefined && (
            <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold text-[#050d1a] bg-[#C8F135] rounded-full shadow-lg">
              {filteredCount}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 hover:bg-white/10 rounded text-white"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Search */}
        <div>
          <label htmlFor="tournament-search" className="block text-sm font-semibold text-gray-200 mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="tournament-search"
              name="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Event name, city..."
              className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8F135]"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Status</label>
          <div className="flex flex-wrap gap-2">
            {['all', 'upcoming', 'ongoing', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter.includes(status)
                    ? 'bg-[#C8F135] text-[#050d1a] shadow-lg'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Distance Filter */}
        {userLocation && onDistanceChange && (
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">
              Distance: {distance === 0 ? 'Toutes' : `${distance} km`}
            </label>
            <input
              type="range"
              min="0"
              max="200"
              step="5"
              value={distance}
              onChange={(e) => onDistanceChange(parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#C8F135]"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Toutes</span>
              <span>200 km</span>
            </div>
          </div>
        )}

         {/* Date Range Filter */}
        <div>
          <label htmlFor="start-date" className="block text-sm font-semibold text-gray-200 mb-2">Date de début</label>
          <input
            id="start-date"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8F135]"
          />
        </div>

        <div>
          <label htmlFor="end-date" className="block text-sm font-semibold text-gray-200 mb-2">Date de fin</label>
          <input
            id="end-date"
            name="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8F135]"
          />
        </div>
   {/* Épreuve Filter */}
        <div>
          <label htmlFor="epreuve-select" className="block text-sm font-semibold text-gray-200 mb-2">Épreuve</label>
          <select
            id="epreuve-select"
            name="epreuve"
            value={selectedEpreuve}
            onChange={(e) => setSelectedEpreuve(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
          >
            <option value="" class="bg-[#0a1628] text-gray-300">Toutes les épreuves</option>
            {allEpreuves.filter(Boolean).map((epreuve) => (
              <option key={epreuve} value={epreuve} class="bg-[#0a1628] text-gray-300">
                {epreuve}
              </option>
            ))}
          </select>
        </div>

        {/* TMC Filter */}
        <div>
          <label htmlFor="tmc-checkbox" className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded">
            <input
              id="tmc-checkbox"
              name="tmc"
              type="checkbox"
              checked={tmcOnly}
              onChange={(e) => setTmcOnly(e.target.checked)}
              className="rounded border-white/20 text-[#C8F135] bg-white/10 focus:ring-[#C8F135]"
            />
            <span className="text-sm font-semibold text-gray-200">TMC</span>
          </label>
        </div>

        {/* Inscription Ouverte Filter */}
        <div>
          <label htmlFor="inscription-ouverte-checkbox" className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded">
            <input
              id="inscription-ouverte-checkbox"
              name="inscriptionOuverte"
              type="checkbox"
              checked={inscriptionOuverte}
              onChange={(e) => setInscriptionOuverte(e.target.checked)}
              className="rounded border-white/20 text-[#C8F135] bg-white/10 focus:ring-[#C8F135]"
            />
            <span className="text-sm font-semibold text-gray-200">Inscription Ouverte</span>
          </label>
        </div>

 {/* Profile Quick Select */}
        {players.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">Profil (sélection rapide)</label>
            <div className="flex flex-wrap gap-2">
              {players.filter(player => player && player.id).map((player) => (
                <button
                  key={player.id}
                  onClick={() => selectProfilePlayer(player.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedProfilePlayer === player.id
                      ? 'bg-[#C8F135] text-[#050d1a] shadow-lg'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {player.first_name}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Categories */}
        {sortedCategories.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">Categories</label>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {sortedCategories.filter(Boolean).map((category, idx) => (
                <label key={category} htmlFor={`cat-${idx}`} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded">
                  <input
                    id={`cat-${idx}`}
                    name={`cat-${idx}`}
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={() => toggleCategory(category)}
                    className="rounded border-white/20 text-[#C8F135] bg-white/10 focus:ring-[#C8F135]"
                  />
                  <span className="text-sm text-gray-300">{category}</span>
                </label>
              ))}
            </div>
          </div>
        )}



        {/* Surface */}
        {allSurfaces.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">Surface</label>
            <div className="space-y-1">
              {allSurfaces.filter(Boolean).map((surface, idx) => (
                <label key={surface} htmlFor={`surf-${idx}`} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded">
                  <input
                    id={`surf-${idx}`}
                    name={`surf-${idx}`}
                    type="checkbox"
                    checked={selectedSurfaces.includes(surface)}
                    onChange={() => toggleSurface(surface)}
                    className="rounded border-white/20 text-[#C8F135] bg-white/10 focus:ring-[#C8F135]"
                  />
                  <span className="text-sm text-gray-300">{surface}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Player Filter */}
        {players.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">Mes joueurs</label>
            <div className="space-y-1">
              {players.filter(player => player && player.id).map((player, idx) => (
                <label key={player.id} htmlFor={`plyr-${idx}`} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded">
                  <input
                    id={`plyr-${idx}`}
                    name={`plyr-${idx}`}
                    type="checkbox"
                    checked={selectedPlayers.includes(player.id)}
                    onChange={() => togglePlayer(player.id)}
                    className="rounded border-white/20 text-[#C8F135] bg-white/10 focus:ring-[#C8F135]"
                  />
                  <span className="text-sm text-gray-300">{player.first_name} {player.last_name}</span>
                </label>
              ))}
            </div>
          </div>
        )}




        {/* Clear Filters */}
        <button
          onClick={clearFilters}
          className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded-lg text-sm font-medium transition"
        >
          Clear All Filters
        </button>
      </div>
    </div>
  );
}
