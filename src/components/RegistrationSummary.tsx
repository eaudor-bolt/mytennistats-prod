import { useMemo, useEffect, useState } from 'react';
import { addDays } from 'date-fns';
import { supabase, UserPlayer, TournamentRegistration, Tournament, Convocation } from '../lib/supabase';
import { usePlayers } from '../contexts/PlayersContext';
import { RefreshCw, Trophy } from 'lucide-react';

type RegistrationSummaryProps = {
  tournaments: Tournament[];
  convocations: Convocation[];
  onConvocationClick?: (tournament: Tournament) => void;
  onPeriodClick?: (player: string, period: string, tournaments: Tournament[]) => void;
  onRefresh?: () => void | Promise<void>;
};

export function RegistrationSummary({ tournaments, convocations, onConvocationClick, onPeriodClick, onRefresh }: RegistrationSummaryProps) {
  const { players } = usePlayers();
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{ player: string; period: string; tournaments: Tournament[] }>({
    player: '',
    period: '',
    tournaments: []
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getPlayerDisplayName = (player: UserPlayer) => {
    return player.first_name;
  };

  useEffect(() => {
    loadRegistrations();
  }, [players]);

  const loadRegistrations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: regsData } = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('user_id', user.id);

    if (regsData) {
      setRegistrations(regsData);
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next7Days = addDays(startOfToday, 7);
    const next30Days = addDays(startOfToday, 30);
    const next90Days = addDays(startOfToday, 90);

    const calculateRegistrations = (startDate: Date, endDate: Date) => {
      const counts: Record<string, number> = {};
      const tournamentsList: Record<string, Tournament[]> = {};

      players.forEach(p => {
        const displayName = getPlayerDisplayName(p);
        counts[displayName] = 0;
        tournamentsList[displayName] = [];
      });

      registrations.forEach(reg => {
        const tournament = tournaments.find(t => t.id === reg.tournament_id);
        if (!tournament) return;

        const player = players.find(p => p.id === reg.player_id);
        if (!player) return;

        const displayName = getPlayerDisplayName(player);
        const tournamentStart = new Date(tournament.start_date);
        const tournamentEnd = new Date(tournament.end_date);

        const isCurrentlyRunning = startOfToday >= tournamentStart && startOfToday <= tournamentEnd;
        const startsInPeriod = tournamentStart >= startDate && tournamentStart <= endDate;
        const endsInPeriod = tournamentEnd >= startDate && tournamentEnd <= endDate;
        const isWithinRange = isCurrentlyRunning || startsInPeriod || endsInPeriod;

        if (isWithinRange) {
          counts[displayName]++;
          if (!tournamentsList[displayName].some(t => t.id === tournament.id)) {
            tournamentsList[displayName].push(tournament);
          }
        }
      });

      return { counts, tournamentsList };
    };

    const getNextConvocations = () => {
      const nextConvocations: Record<string, { date: Date; dateString: string; time: string; tournament: Tournament | null }> = {};

      convocations.forEach(conv => {
        const convDate = new Date(conv.convocation_date);

        if (convDate >= startOfToday) {
          const current = nextConvocations[conv.player_name];

          if (!current || convDate < current.date) {
            // Try to find tournament by tournament_id first, then fall back to event_code
            let tournament = conv.tournament_id
              ? tournaments.find(t => t.id === conv.tournament_id)
              : null;

            if (!tournament && conv.event_code) {
              tournament = tournaments.find(t => t.event_code === conv.event_code);
            }

            nextConvocations[conv.player_name] = {
              date: convDate,
              dateString: conv.convocation_date,
              time: conv.convocation_time,
              tournament: tournament || null
            };
          }
        }
      });

      return nextConvocations;
    };

    const period7Days = calculateRegistrations(startOfToday, next7Days);
    const period30Days = calculateRegistrations(startOfToday, next30Days);
    const period90Days = calculateRegistrations(startOfToday, next90Days);

    return {
      nextConvocations: getNextConvocations(),
      'prochains 7j': period7Days.counts,
      'prochains 7j_tournaments': period7Days.tournamentsList,
      'prochains mois': period30Days.counts,
      'prochains mois_tournaments': period30Days.tournamentsList,
      'prochain trimestre': period90Days.counts,
      'prochain trimestre_tournaments': period90Days.tournamentsList,
    };
  }, [tournaments, registrations, players, convocations]);

  const playerColors = [
    '#3b82f6',
    '#f97316',
    '#ef4444',
    '#8b5cf6',
    '#10b981',
  ];

  const Badge = ({ value, color, onClick, clickable }: { value: string | number; color: string; onClick?: () => void; clickable?: boolean }) => {
    const isClickable = clickable !== false && !!onClick;
    return (
      <div
        onClick={onClick}
        style={{
          backgroundColor: color,
          color: '#ffffff',
          padding: '2px 4px',
          borderRadius: '8px',
          fontSize: '9px',
          fontWeight: 'bold',
          textAlign: 'center',
          minWidth: '16px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          cursor: isClickable ? 'pointer' : 'default',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          if (isClickable) {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
          }
        }}
        onMouseLeave={(e) => {
          if (isClickable) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
          }
        }}
      >
        {value}
      </div>
    );
  };

  const NumberBadge = ({ value, onClick, clickable }: { value: number; onClick?: () => void; clickable?: boolean }) => (
    <div
      onClick={onClick}
      style={{
        color: '#C8F135',
        padding: '2px 4px',
        borderRadius: '8px',
        fontSize: '10px',
        fontWeight: 'bold',
        textAlign: 'center',
        minWidth: '16px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={(e) => {
        if (clickable) {
          e.currentTarget.style.transform = 'scale(1.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (clickable) {
          e.currentTarget.style.transform = 'scale(1)';
        }
      }}
    >
      <span style={{ color: '#C8F135' }}>{value}</span>
      <Trophy size={10} style={{ color: '#C8F135' }} />
    </div>
  );

  const handleBadgeClick = (player: string, period: string, count: number) => {
    if (count === 0) return;

    const tournamentsKey = `${period}_tournaments` as keyof typeof stats;
    const tournamentsList = stats[tournamentsKey] ? (stats[tournamentsKey] as Record<string, Tournament[]>)[player] : [];

    setModalData({
      player,
      period,
      tournaments: tournamentsList
    });
    setShowModal(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
      await loadRegistrations();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (players.length === 0) return null;

  return (
    <>
      <div className="mb-5 rounded-lg overflow-hidden border border-white/20 w-full max-w-full mx-auto">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs min-w-[320px]">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-white/20">
                  <div className="flex items-center justify-between gap-1">
                    <span>Période</span>
                    {onRefresh && (
                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-0.5 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                        title="Actualiser"
                      >
                        <RefreshCw
                          size={10}
                          className={isRefreshing ? 'animate-spin' : ''}
                        />
                      </button>
                    )}
                  </div>
                </th>
                {players.map((player, idx) => (
                  <th
                    key={player.id}
                    className={`px-2 py-1.5 text-center text-[10px] font-bold text-white uppercase tracking-wider ${
                      idx < players.length - 1 ? 'border-r border-white/20' : ''
                    }`}
                  >
                    {getPlayerDisplayName(player)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1.5 text-[10px] font-medium text-white border-r border-white/20">
                  Prochaine Convocation
                </td>
                {players.map((player, idx) => {
                  const displayName = getPlayerDisplayName(player);
                  const convocation = stats.nextConvocations[displayName];
                  const playerColor = playerColors[idx % playerColors.length];

                  return (
                    <td
                      key={player.id}
                      className={`px-2 py-1.5 text-center ${
                        idx < players.length - 1 ? 'border-r border-white/20' : ''
                      }`}
                    >
                      {convocation ? (
                        <div className="flex flex-col gap-0.5 items-center">
                          <Badge
                            value={formatDate(convocation.dateString)}
                            color={playerColor}
                            onClick={() => {
                              if (onConvocationClick) {
                                if (convocation.tournament) {
                                  onConvocationClick(convocation.tournament);
                                } else {
                                  console.warn('Tournament not found for convocation:', convocation);
                                  alert('Le tournoi correspondant à cette convocation n\'a pas été trouvé.');
                                }
                              }
                            }}
                            clickable={true}
                          />
                          <span className="text-[8px] text-white/80">
                            {convocation.time}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-white/50">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
              {(['prochains 7j', 'prochains mois', 'prochain trimestre'] as const).map((period) => (
                <tr key={period}>
                  <td className="px-2 py-1.5 text-[10px] font-medium text-white border-r border-white/20">
                    {period}
                  </td>
                  {players.map((player, idx) => {
                    const displayName = getPlayerDisplayName(player);
                    const count = (stats[period] as Record<string, number>)[displayName] || 0;
                    return (
                      <td
                        key={player.id}
                        className={`px-2 py-1.5 text-center ${
                          idx < players.length - 1 ? 'border-r border-white/20' : ''
                        }`}
                      >
                        {count > 0 ? (
                          <NumberBadge
                            value={count}
                            onClick={() => handleBadgeClick(displayName, period, count)}
                            clickable={count > 0}
                          />
                        ) : (
                          <span className="text-[10px] text-white/50">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">
                {modalData.player} - {modalData.period}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-2xl text-gray-500 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
              >
                ×
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="mb-4 text-sm text-gray-600">
                {modalData.tournaments.length} tournoi{modalData.tournaments.length > 1 ? 's' : ''}
              </p>
              {modalData.tournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  onClick={() => {
                    if (onConvocationClick) {
                      onConvocationClick(tournament);
                    }
                    setShowModal(false);
                  }}
                  className="p-3 my-2 border-l-4 border-blue-500 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors rounded"
                >
                  <div className="font-semibold text-sm text-gray-800 mb-1">
                    {tournament.organizer}
                  </div>
                  <div className="text-xs text-gray-600">
                    📅 {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    📍 {tournament.venue_city}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
