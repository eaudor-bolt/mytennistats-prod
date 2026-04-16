import { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isToday, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tournament, UserPlayer, TournamentRegistration, Convocation } from '../lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePlayers } from '../contexts/PlayersContext';
import { useTournamentData } from '../contexts/TournamentDataContext';

type TournamentCalendarProps = {
  tournaments: Tournament[];
  convocations: Convocation[];
  onSelectTournament: (id: string) => void;
  onOpenTournamentModal: (tournament: Tournament) => void;
  onOpenConvocationModal?: (date: string) => void;
  registrationVersion?: number;
};

type RegistrationWithDetails = TournamentRegistration & {
  player: UserPlayer;
  tournament: Tournament;
};

export function TournamentCalendar({
  tournaments,
  convocations,
  onSelectTournament,
  onOpenTournamentModal,
  onOpenConvocationModal,
  registrationVersion
}: TournamentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { players } = usePlayers();
  const { registrations: allRegistrations } = useTournamentData();
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, boolean>>({});
  const [registrations, setRegistrations] = useState<RegistrationWithDetails[]>([]);
  const [showConvocations, setShowConvocations] = useState(true);

  useEffect(() => {
    if (players.length > 0) {
      const initialSelected: Record<string, boolean> = {};
      players.forEach(player => {
        initialSelected[player.id] = true;
      });
      setSelectedPlayers(initialSelected);
    }
  }, [players]);

  useEffect(() => {
    const regsWithDetails: RegistrationWithDetails[] = allRegistrations.map(reg => {
      const player = players.find(p => p.id === reg.player_id);
      const tournament = tournaments.find(t => t.id === reg.tournament_id);
      return {
        ...reg,
        player: player!,
        tournament: tournament!
      };
    }).filter(reg => reg.player && reg.tournament);

    setRegistrations(regsWithDetails);
  }, [allRegistrations, players, tournaments]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const rows = [];
  let day = startDate;

  while (day <= endDate) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(day);
      const isOutside = !isSameMonth(currentDay, monthStart);
      const today = isToday(currentDay);

      const dayRegistrations = registrations.filter(reg => {
        if (!selectedPlayers[reg.player_id]) return false;
        const eventStart = new Date(reg.tournament.start_date);
        eventStart.setHours(0, 0, 0, 0);
        const eventEnd = new Date(reg.tournament.end_date);
        eventEnd.setHours(23, 59, 59, 999);
        const checkDay = new Date(currentDay);
        checkDay.setHours(12, 0, 0, 0);
        return checkDay >= eventStart && checkDay <= eventEnd;
      });

      const dayConvocations = showConvocations ? convocations.filter(conv => {
        const convDate = new Date(conv.convocation_date);
        const dateMatches = isSameDay(convDate, currentDay);

        if (!dateMatches) return false;

        // Try to match the player by name
        const player = players.find(p => `${p.first_name} ${p.last_name}` === conv.player_name);

        // If no player match is found, show the convocation anyway (it belongs to the user)
        // If a player match is found, respect the player selection filter
        const shouldShow = !player || selectedPlayers[player.id];

        return shouldShow;
      }) : [];

      const eventGroups: Record<string, { tournament: Tournament; playerIndex: number; isConvocation?: boolean; convocation?: Convocation; isRegistered?: boolean }> = {};

      dayRegistrations.forEach(reg => {
        const key = reg.tournament.id;
        if (!eventGroups[key]) {
          const playerIndex = players.findIndex(p => p.id === reg.player_id);
          eventGroups[key] = { tournament: reg.tournament, playerIndex, isRegistered: true };
        } else {
          const playerIndex = players.findIndex(p => p.id === reg.player_id);
          eventGroups[key] = { ...eventGroups[key], playerIndex, isRegistered: true };
        }
      });

      dayConvocations.forEach(conv => {
        const key = `conv-${conv.id}`;

        // Try to find tournament by tournament_id first, then fall back to event_code
        let tournament = conv.tournament_id
          ? tournaments.find(t => t.id === conv.tournament_id)
          : null;

        if (!tournament && conv.event_code) {
          tournament = tournaments.find(t => t.event_code === conv.event_code);
        }

        if (tournament) {
          eventGroups[key] = {
            tournament,
            playerIndex: -1,
            isConvocation: true,
            convocation: conv
          };
        } else {
          // Create placeholder tournament for convocations without a matching tournament
          const placeholderTournament: Tournament = {
            id: `placeholder-${conv.id}`,
            event_code: conv.event_code || 'N/A',
            organizer: conv.location || 'N/A',
            title: '',
            venue_city: '',
            venue_address: conv.location || '',
            start_date: conv.convocation_date,
            end_date: conv.convocation_date,
            deadline_date: conv.convocation_date,
            category: 'N/A',
            junior_category: null,
            prize_money: null,
            prize_money_currency: null,
            payment_method: null,
            hotel_name: null,
            hotel_phone: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          eventGroups[key] = {
            tournament: placeholderTournament,
            playerIndex: -1,
            isConvocation: true,
            convocation: conv
          };
        }
      });

      days.push(
        <div
          key={currentDay.toISOString()}
          className={`min-h-[60px] md:min-h-[80px] border border-gray-200 p-1 md:p-2 relative ${
            isOutside ? 'bg-gray-50' : 'bg-white'
          } ${today ? 'ring-2 ring-green-600' : ''}`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold text-xs md:text-sm text-gray-700 flex-shrink-0 w-5 md:w-auto">
              {format(currentDay, 'd')}
            </div>
            {!isOutside && onOpenConvocationModal && (
              <button
                className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-white bg-green-600 hover:bg-green-700 rounded-full transition-colors text-xs md:text-sm font-bold shadow-sm flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  const formattedDate = format(currentDay, 'yyyy-MM-dd');
                  onOpenConvocationModal(formattedDate);
                }}
                title="Ajouter une convocation"
              >
                +
              </button>
            )}
          </div>

          <div className="space-y-1">
            {Object.entries(eventGroups).map(([tournamentId, { tournament, playerIndex, isConvocation, convocation, isRegistered }]) => {
              const playerColors = [
                '#3b82f6',
                '#f97316',
                '#ef4444',
                '#8b5cf6',
                '#10b981',
              ];
              const bgColor = isConvocation
                ? '#000000'
                : (isRegistered && playerIndex >= 0)
                  ? playerColors[playerIndex % playerColors.length]
                  : '#6b7280';
              const displayText = isConvocation && convocation
                ? `CONVOC: ${convocation.player_name} ${convocation.convocation_time.substring(0, 5)}`
                : tournament.organizer;

              return (
                <div
                  key={tournamentId}
                  className="text-[10px] md:text-xs p-0.5 md:p-1 rounded cursor-pointer text-white truncate hover:shadow-md transition-shadow"
                  style={{ backgroundColor: bgColor }}
                  onClick={() => {
                    const lat = Number(tournament.latitude);
                    const lng = Number(tournament.longitude);

                    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                      onSelectTournament(tournament.id);
                    }

                    onOpenTournamentModal(tournament);
                  }}
                  title={isConvocation ? `${tournament.organizer} - ${convocation?.player_name} at ${convocation?.convocation_time}` : tournament.organizer}
                >
                  {displayText.length > 10 ? displayText.substring(0, 10) + '...' : displayText}
                </div>
              );
            })}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="grid grid-cols-7 gap-px bg-gray-200" key={day.toISOString()}>
        {days}
      </div>
    );
  }

  const playerColors = [
    { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-600' },
    { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-600' },
    { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-600' },
    { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-600' },
    { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-600' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-2 md:p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-2 md:mb-4 flex-shrink-0">
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
          className="p-1 md:p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-700" />
        </button>
        <h3 className="text-lg md:text-2xl font-bold text-gray-900">
          {format(monthStart, 'MMMM yyyy', { locale: fr })}
        </h3>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 md:p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Mois suivant"
        >
          <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-gray-700" />
        </button>
      </div>

      <div className="mb-2 md:mb-4 flex flex-wrap gap-2 md:gap-3 flex-shrink-0">
        {players.map((player, idx) => {
          const color = playerColors[idx % playerColors.length];
          const displayName = `${player.first_name} ${player.last_name}`;
          return (
            <label key={player.id} className="flex items-center gap-1 md:gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPlayers[player.id] || false}
                onChange={(e) => setSelectedPlayers(prev => ({ ...prev, [player.id]: e.target.checked }))}
                className={`w-3 h-3 md:w-4 md:h-4 rounded ${color.text} focus:ring-2 focus:ring-offset-0`}
              />
              <span className={`text-xs md:text-sm font-medium ${color.text}`}>{displayName}</span>
            </label>
          );
        })}
        <label className="flex items-center gap-1 md:gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showConvocations}
            onChange={(e) => setShowConvocations(e.target.checked)}
            className="w-3 h-3 md:w-4 md:h-4 rounded text-gray-900 focus:ring-2 focus:ring-offset-0"
          />
          <span className="text-xs md:text-sm font-medium text-gray-900">Convocations</span>
        </label>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 mb-px flex-shrink-0">
        {dayLabels.map(label => (
          <div key={label} className="bg-gray-100 p-1 md:p-2 text-center font-semibold text-[10px] md:text-sm text-gray-700">
            {label}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="space-y-px bg-gray-200 h-full overflow-y-auto">
          {rows}
        </div>
      </div>
    </div>
  );
}
