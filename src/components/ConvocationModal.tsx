import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase, Tournament, TournamentRegistration } from '../lib/supabase';
import { usePlayers } from '../contexts/PlayersContext';
import { trackConvocationAction } from '../utils/analytics';
import { useAlert } from '../hooks/useAlert';

type ConvocationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  tournaments: Tournament[];
  registrations: TournamentRegistration[];
  onConvocationCreated: () => void;
};

export function ConvocationModal({
  isOpen,
  onClose,
  selectedDate,
  tournaments,
  registrations,
  onConvocationCreated
}: ConvocationModalProps) {
  const { players } = usePlayers();
  const { showAlert, AlertComponent } = useAlert();
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedTournament, setSelectedTournament] = useState('');
  const [eventDetails, setEventDetails] = useState('');
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [playerTournaments, setPlayerTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    if (selectedPlayer && selectedDate) {
      loadPlayerTournaments();
    }
  }, [selectedPlayer, selectedDate]);

  const loadPlayerTournaments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const selectedPlayerObj = players.find(p => `${p.first_name} ${p.last_name}`.trim() === selectedPlayer);
    if (!selectedPlayerObj) return;

    const selectedDateObj = new Date(selectedDate);
    const startOfDay = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
    const endOfDay = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate() + 1);

    const { data: registrations } = await supabase
      .from('tournament_registrations')
      .select('tournament_id')
      .eq('user_id', user.id)
      .eq('player_id', selectedPlayerObj.id);

    if (!registrations || registrations.length === 0) {
      setPlayerTournaments([]);
      return;
    }

    const tournamentIds = registrations.map(r => r.tournament_id);

    const { data: tournamentsData } = await supabase
      .from('tournaments')
      .select('*')
      .in('id', tournamentIds)
      .lte('start_date', endOfDay.toISOString().split('T')[0])
      .gte('end_date', startOfDay.toISOString().split('T')[0])
      .order('start_date', { ascending: false });

    setPlayerTournaments(tournamentsData || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlayer || !selectedTournament || !selectedDate || !selectedTime) {
      showAlert('Veuillez remplir tous les champs', { type: 'warning' });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Vous devez être connecté');
      }

      const tournament = playerTournaments.find(t => `${t.organizer} - ${t.title}` === selectedTournament);
      const eventName = selectedTournament === 'N/A' ? 'N/A' : selectedTournament;
      const eventCode = tournament ? tournament.event_code : 'N/A';
      const tournamentId = tournament ? tournament.id : null;

      const { error } = await supabase
        .from('convocations')
        .insert({
          user_id: user.id,
          tournament_id: tournamentId,
          player_name: selectedPlayer,
          event_code: eventCode,
          event_details: eventName + (eventDetails ? ' - ' + eventDetails : ''),
          convocation_date: selectedDate,
          convocation_time: selectedTime
        });

      if (error) throw error;

      trackConvocationAction('add', undefined, { tournament_id: tournamentId, player: selectedPlayer });
      showAlert('Convocation créée avec succès!', { type: 'success' });
      setSelectedPlayer('');
      setSelectedTournament('');
      setEventDetails('');
      setSelectedTime('10:00');
      setPlayerTournaments([]);
      onClose();
      onConvocationCreated();
    } catch (error) {
      console.error('Error creating convocation:', error);
      showAlert(`Erreur lors de la création de la convocation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`, { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlayerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPlayer(e.target.value);
    setSelectedTournament('');
    setEventDetails('');
    setPlayerTournaments([]);
  };

  if (!isOpen) return null;

  return (
    <>
      <AlertComponent />
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
      >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Convocation Tournoi</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {selectedDate && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 text-center">
            <strong className="text-gray-900">Date: {new Date(selectedDate).toLocaleDateString('fr-FR')}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="player-select" className="block text-sm font-semibold text-gray-700 mb-2">
              Joueur :
            </label>
            <select
              id="player-select"
              value={selectedPlayer}
              onChange={handlePlayerChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner un joueur</option>
              {players.map(player => {
                const playerName = `${player.first_name} ${player.last_name}`.trim();
                return (
                  <option key={player.id} value={playerName}>{playerName}</option>
                );
              })}
            </select>
          </div>

          {selectedPlayer && (
            <div>
              <label htmlFor="tournament-select" className="block text-sm font-semibold text-gray-700 mb-2">
                Événement :
              </label>
              <select
                id="tournament-select"
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner un événement</option>
                {playerTournaments.length === 0 ? (
                  <option value="N/A">N/A</option>
                ) : (
                  playerTournaments.map(tournament => (
                    <option key={tournament.id} value={`${tournament.organizer} - ${tournament.title}`}>
                      {tournament.organizer} - {tournament.title}
                    </option>
                  ))
                )}
              </select>
              {playerTournaments.length === 0 && selectedPlayer && (
                <p className="mt-2 text-sm text-gray-500">
                  Aucun événement enregistré pour {selectedPlayer} à cette date
                </p>
              )}
            </div>
          )}

          {selectedPlayer && selectedTournament && (
            <>
              <div>
                <label htmlFor="event-details" className="block text-sm font-semibold text-gray-700 mb-2">
                  Détails de l'événement (optionnel) :
                </label>
                <input
                  id="event-details"
                  type="text"
                  value={eventDetails}
                  onChange={(e) => setEventDetails(e.target.value)}
                  placeholder="ex: Tableau principal, R1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Cette information sera ajoutée à l'événement sélectionné
                </p>
              </div>

              <div>
                <label htmlFor="time-select" className="block text-sm font-semibold text-gray-700 mb-2">
                  Heure (HH:MM) :
                </label>
                <input
                  id="time-select"
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedPlayer || !selectedTournament || !selectedDate || !selectedTime}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Création...' : 'Créer Convocation'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
