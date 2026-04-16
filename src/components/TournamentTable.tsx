import { useState, useMemo } from 'react';
import { Tournament, supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { MapPin, Calendar, ExternalLink, Plus, ArrowUp, ArrowDown, ArrowUpDown, Trophy } from 'lucide-react';
import { usePlayers } from '../contexts/PlayersContext';
import { useAuth } from '../contexts/AuthContext';
import { useTournamentData } from '../contexts/TournamentDataContext';

type TournamentTableProps = {
  tournaments: Tournament[];
  onTournamentClick: (tournament: Tournament) => void;
  onRegistrationChange?: () => void;
};

type SortKey = 'inscription' | 'tournament' | 'location' | 'date' | 'status' | 'categories' | 'surface';
type SortDir = 'asc' | 'desc';

const PLAYER_COLORS = [
  { text: '#3b82f6', border: '#3b82f6', hover: '#eff6ff' },
  { text: '#f97316', border: '#f97316', hover: '#fff7ed' },
  { text: '#ef4444', border: '#ef4444', hover: '#fef2f2' },
  { text: '#8b5cf6', border: '#8b5cf6', hover: '#f5f3ff' },
  { text: '#10b981', border: '#10b981', hover: '#ecfdf5' },
];

function getCategoryColor(event: string, index: number) {
  if (event.includes('Dames')) {
    const shades = ['#8b5cf6', '#7c3aed', '#6d28d9'];
    return shades[index % shades.length];
  }
  const shades = ['#22c55e', '#16a34a', '#15803d', '#1da750'];
  return shades[index % shades.length];
}

function createGoogleCalendarLink(tournament: Tournament) {
  const title = encodeURIComponent(tournament.organizer);
  let detailsText = `Tournoi: ${tournament.title}\nOrganisateur: ${tournament.organizer}\nCode: ${tournament.event_code}`;
  if (tournament.judge_arbitrator) detailsText += `\n\nJuge Arbitre: ${tournament.judge_arbitrator}`;
  if (tournament.venue_phone) detailsText += `\nTéléphone: ${tournament.venue_phone}`;
  if (tournament.venue_address) {
    detailsText += `\n\nLieu: ${tournament.venue_address}\n${tournament.venue_postal_code} ${tournament.venue_city}`;
  } else if (tournament.venue_city) {
    detailsText += `\n\nLieu: ${tournament.venue_city}`;
  }
  const details = encodeURIComponent(detailsText);
  const locationParts = [];
  if (tournament.venue_address) locationParts.push(tournament.venue_address);
  if (tournament.venue_postal_code) locationParts.push(tournament.venue_postal_code);
  if (tournament.venue_city) locationParts.push(tournament.venue_city);
  const location = encodeURIComponent(locationParts.join(', ') || tournament.organizer);
  const startDate = tournament.start_date.replace(/-/g, '');
  const endDate = tournament.end_date.replace(/-/g, '');
  return `https://calendar.google.com/calendar/u/0/r/eventedit?text=${title}&details=${details}&location=${location}&dates=${startDate}T090000Z/${endDate}T090000Z&ctz=Europe/Paris`;
}

function getStatusOrder(tournament: Tournament): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const startDate = new Date(tournament.start_date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(tournament.end_date);
  endDate.setHours(23, 59, 59, 999);
  if (startDate <= now && endDate >= now) return 0;
  if (endDate < now) return 2;
  return 1;
}

export function TournamentTable({ tournaments, onTournamentClick, onRegistrationChange }: TournamentTableProps) {
  const { players } = usePlayers();
  const { user } = useAuth();
  const { registrations: allRegistrations, refreshData } = useTournamentData();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedTournaments = useMemo(() => {
    if (!sortKey) return tournaments;

    return [...tournaments].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'inscription': {
          const aCount = allRegistrations.filter(r => r.tournament_id === a.id).length;
          const bCount = allRegistrations.filter(r => r.tournament_id === b.id).length;
          cmp = aCount - bCount;
          break;
        }
        case 'tournament':
          cmp = a.organizer.localeCompare(b.organizer);
          break;
        case 'location':
          cmp = (a.venue_city || '').localeCompare(b.venue_city || '');
          break;
        case 'date':
          cmp = a.start_date.localeCompare(b.start_date);
          break;
        case 'status':
          cmp = getStatusOrder(a) - getStatusOrder(b);
          break;
        case 'categories': {
          const aCats = a.categories?.length || 0;
          const bCats = b.categories?.length || 0;
          cmp = aCats - bCats;
          break;
        }
        case 'surface':
          cmp = (a.surface || '').localeCompare(b.surface || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tournaments, sortKey, sortDir, allRegistrations]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    if (sortDir === 'asc') return <ArrowUp className="w-3 h-3 ml-1" />;
    return <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const getStatusBadge = (tournament: Tournament) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startDate = new Date(tournament.start_date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(tournament.end_date);
    endDate.setHours(23, 59, 59, 999);

    if (endDate < now) {
      return <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-gray-400 rounded border border-white/10">Completed</span>;
    } else if (startDate <= now && endDate >= now) {
      return <span className="px-2 py-0.5 text-xs font-medium bg-[#C8F135]/20 text-[#C8F135] rounded border border-[#C8F135]/30">Ongoing</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium bg-[#1A6FC4]/20 text-[#1A6FC4] rounded border border-[#1A6FC4]/30">Upcoming</span>;
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (startDate.toDateString() === endDate.toDateString()) {
      return format(startDate, 'dd MMM yyyy');
    }
    return `${format(startDate, 'dd MMM')} - ${format(endDate, 'dd MMM yyyy')}`;
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const toggleRegistration = async (playerId: string, tournamentId: string) => {
    if (!user) return;
    const registrations = allRegistrations.filter(r => r.tournament_id === tournamentId);
    const existing = registrations.find(r => r.player_id === playerId);

    if (existing) {
      if (!existing.paid) {
        await supabase.from('tournament_registrations').update({ paid: true }).eq('id', existing.id);
      } else {
        await supabase.from('tournament_registrations').delete().eq('id', existing.id);
      }
    } else {
      await supabase.from('tournament_registrations').insert({
        user_id: user.id,
        tournament_id: tournamentId,
        player_id: playerId,
        paid: false,
      }).select().single();
    }
    await refreshData();
    if (onRegistrationChange) onRegistrationChange();
  };

  const isPlayerRegistered = (playerId: string, tournamentId: string) => {
    return allRegistrations.some(r => r.player_id === playerId && r.tournament_id === tournamentId);
  };

  const getRegistrationTicks = (playerId: string, tournamentId: string) => {
    const reg = allRegistrations.find(r => r.player_id === playerId && r.tournament_id === tournamentId);
    if (!reg) return '';
    return reg.paid ? ' \u2713\u2713' : ' \u2713';
  };

  const thClass = 'px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider cursor-pointer select-none hover:bg-white/10 transition-colors';

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden w-full max-w-full">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className={thClass} onClick={() => handleSort('inscription')}>
                <span className="inline-flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  Inscription
                  <SortIcon column="inscription" />
                </span>
              </th>
              <th className={thClass} onClick={() => handleSort('tournament')}>
                <span className="inline-flex items-center">
                  Tournament
                  <SortIcon column="tournament" />
                </span>
              </th>
              <th className={`${thClass} hidden md:table-cell`} onClick={() => handleSort('location')}>
                <span className="inline-flex items-center">
                  Location
                  <SortIcon column="location" />
                </span>
              </th>
              <th className={`${thClass} hidden lg:table-cell`} onClick={() => handleSort('date')}>
                <span className="inline-flex items-center">
                  Date
                  <SortIcon column="date" />
                </span>
              </th>
              <th className={`${thClass} hidden sm:table-cell`} onClick={() => handleSort('status')}>
                <span className="inline-flex items-center">
                  Status
                  <SortIcon column="status" />
                </span>
              </th>
              <th className={`${thClass} hidden xl:table-cell`} onClick={() => handleSort('categories')}>
                <span className="inline-flex items-center">
                  Categories
                  <SortIcon column="categories" />
                </span>
              </th>
              <th className={`${thClass} hidden xl:table-cell`} onClick={() => handleSort('surface')}>
                <span className="inline-flex items-center">
                  Surface
                  <SortIcon column="surface" />
                </span>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedTournaments.map((tournament) => {
              const hasOuverture = !!tournament.date_ouverture_inscription;
              const ouvertureDate = hasOuverture ? new Date(tournament.date_ouverture_inscription!) : null;
              const ouvertureIsFuture = ouvertureDate ? ouvertureDate > new Date() : false;

              return (
                <tr
                  key={tournament.id}
                  onClick={() => onTournamentClick(tournament)}
                  className="hover:bg-white/5 cursor-pointer transition-all duration-200"
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1">
                      {players.map((player, idx) => {
                        const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
                        const registered = isPlayerRegistered(player.id, tournament.id);
                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => toggleRegistration(player.id, tournament.id)}
                            className="inscription-button text-xs px-2 py-1 rounded border-2 transition-all"
                            style={{
                              color: registered ? 'white' : color.text,
                              borderColor: color.border,
                              backgroundColor: registered ? color.text : 'transparent',
                              fontWeight: '600',
                            }}
                            onMouseEnter={(e) => {
                              if (!registered) {
                                e.currentTarget.style.backgroundColor = color.text + '20';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = registered ? color.text : 'transparent';
                            }}
                          >
                            {player.first_name}{getRegistrationTicks(player.id, tournament.id)}
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-white text-sm">{tournament.organizer}</div>
                      <div className="text-xs text-gray-300">{tournament.title}</div>
                      <div className="md:hidden text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {tournament.venue_city}
                      </div>
                      <div className="lg:hidden text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateRange(tournament.start_date, tournament.end_date)}
                      </div>
                      <div className="sm:hidden mt-1">
                        {getStatusBadge(tournament)}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm text-gray-300 hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-xs">{tournament.venue_city}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm text-gray-300 hidden lg:table-cell">
                    <div className="space-y-1">
                      <div className="text-xs">{formatDateRange(tournament.start_date, tournament.end_date)}</div>
                      {hasOuverture && (
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${
                            ouvertureIsFuture
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-green-500/20 text-green-400 border-green-500/30'
                          }`}
                        >
                          Ouverture: {formatShortDate(tournament.date_ouverture_inscription!)}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 hidden sm:table-cell">
                    {getStatusBadge(tournament)}
                  </td>

                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                      {tournament.categories && tournament.categories.length > 0 ? (
                        tournament.categories.map((cat, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-white text-xs font-medium whitespace-nowrap"
                            style={{ backgroundColor: getCategoryColor(cat.event, idx) }}
                          >
                            <span className="font-bold">({cat.category})</span>
                            <span>{cat.event}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm text-gray-300 hidden xl:table-cell">
                    <span className="text-xs">{tournament.surface || '-'}</span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://tenup.fft.fr/tournoi/${tournament.event_code.slice(-6)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all inline-flex items-center gap-1"
                        title="View on TenUp"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <a
                        href={createGoogleCalendarLink(tournament)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-[#C8F135] hover:bg-[#C8F135]/20 rounded transition-all inline-flex items-center gap-1"
                        title="Add to Calendar"
                      >
                        <Calendar className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tournaments.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-300">No tournaments found</p>
        </div>
      )}
    </div>
  );
}
