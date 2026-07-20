import { useState, useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { MatchResult, supabase, Tournament } from '../lib/supabase';
import { usePlayers } from '../contexts/PlayersContext';

type RegistrationRow = {
  player_id: string;
  tournament_name: string | null;
  tournaments: Tournament | null;
};

type AddMatchResultModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchData: Omit<MatchResult, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  editingMatch: MatchResult | null;
  initialData?: {
    date?: string;
    player_name?: string;
    tournament_name?: string;
    score?: string;
    classement?: 'NC' | '40' | '30' | '15';
    forehand?: 'bad' | 'good' | 'great';
    backhand?: 'bad' | 'good' | 'great';
    serve?: 'bad' | 'good' | 'great';
    return?: 'bad' | 'good' | 'great';
    scoring_history?: any[];
    game_per_set?: 3 | 4 | 6;
    super_tiebreak?: boolean;
    no_ad?: boolean;
  };
};

export function AddMatchResultModal({ isOpen, onClose, onSave, editingMatch, initialData }: AddMatchResultModalProps) {
  const { players } = usePlayers();
  const [formData, setFormData] = useState({
    date: '',
    player_name: '',
    tournament_name: '',
    event_details: '',
    score: '',
    classement: 'NC' as 'NC' | '40' | '30' | '15',
    forehand: 'good' as 'bad' | 'good' | 'great',
    backhand: 'good' as 'bad' | 'good' | 'great',
    serve: 'good' as 'bad' | 'good' | 'great',
    return: 'good' as 'bad' | 'good' | 'great',
    comments: '',
    scoring_history: [] as any[],
    game_per_set: undefined as 3 | 4 | 6 | undefined,
    super_tiebreak: false,
    no_ad: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [isAddingCustomEvent, setIsAddingCustomEvent] = useState(false);

  useEffect(() => {
    if (editingMatch) {
      setFormData({
        date: editingMatch.date,
        player_name: editingMatch.player_name,
        tournament_name: editingMatch.tournament_name,
        event_details: editingMatch.event_details || '',
        score: editingMatch.score,
        classement: editingMatch.classement,
        forehand: editingMatch.impressions.forehand,
        backhand: editingMatch.impressions.backhand,
        serve: editingMatch.impressions.serve,
        return: editingMatch.impressions.return,
        comments: editingMatch.comments || '',
        scoring_history: editingMatch.scoring_history || [],
        game_per_set: editingMatch.game_per_set,
        super_tiebreak: editingMatch.super_tiebreak || false,
        no_ad: editingMatch.no_ad || false,
      });
    } else {
      setFormData({
        date: initialData?.date || new Date().toISOString().split('T')[0],
        player_name: initialData?.player_name || '',
        tournament_name: initialData?.tournament_name || '',
        event_details: '',
        score: initialData?.score || '',
        classement: initialData?.classement || 'NC',
        forehand: initialData?.forehand || 'good',
        backhand: initialData?.backhand || 'good',
        serve: initialData?.serve || 'good',
        return: initialData?.return || 'good',
        comments: '',
        scoring_history: initialData?.scoring_history || [],
        game_per_set: initialData?.game_per_set,
        super_tiebreak: initialData?.super_tiebreak || false,
        no_ad: initialData?.no_ad || false,
      });
    }
    setIsAddingCustomEvent(false);
  }, [editingMatch, isOpen, initialData]);

  // Fetch every player's tournament registrations in a single request when the
  // modal opens, instead of re-querying per player selected in the dropdown.
  useEffect(() => {
    if (isOpen) {
      loadAllTournamentRegistrations();
    }
  }, [isOpen]);

  const loadAllTournamentRegistrations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('player_id, tournament_name, tournaments(*)')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error loading tournament registrations:', error);
      setRegistrations([]);
      return;
    }

    setRegistrations((data || []) as unknown as RegistrationRow[]);
  };

  // Events registered for the currently selected player: catalogued
  // tournaments (filtered to those overlapping the selected match date) plus
  // custom, free-text events added via "+ Ajouter un événement". Derived
  // client-side from the single fetch above, so switching players never
  // triggers a new request.
  const playerEvents = useMemo(() => {
    const selectedPlayer = players.find(p => p.first_name === formData.player_name);
    if (!selectedPlayer) return [];

    const forPlayer = registrations.filter(r => r.player_id === selectedPlayer.id);

    const fromTournaments = forPlayer
      .filter(r => r.tournaments)
      .map(r => r.tournaments as Tournament)
      .filter(t => !formData.date || (t.start_date <= formData.date && t.end_date >= formData.date))
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
      .map(t => ({ key: t.id, label: `${t.organizer} - ${t.title}` }));

    const fromCustom = forPlayer
      .filter(r => !r.tournaments && r.tournament_name)
      .map(r => ({ key: `custom-${r.tournament_name}`, label: r.tournament_name as string }));

    const seenLabels = new Set<string>();
    return [...fromTournaments, ...fromCustom].filter(e => {
      if (seenLabels.has(e.label)) return false;
      seenLabels.add(e.label);
      return true;
    });
  }, [registrations, players, formData.player_name, formData.date]);

  // Persists a manually-typed event ("+ Ajouter un événement") as a
  // tournament_registrations row with no tournament_id, so it appears in this
  // player's event list on future matches. Skips the insert if this exact
  // custom name is already registered for the player, to avoid duplicates
  // piling up every time the same one-off event is reused.
  const saveCustomEventRegistration = async (playerName: string, eventName: string) => {
    const selectedPlayer = players.find(p => p.first_name === playerName);
    if (!selectedPlayer) return;

    const alreadyRegistered = registrations.some(
      r => r.player_id === selectedPlayer.id && r.tournament_name === eventName
    );
    if (alreadyRegistered) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('tournament_registrations')
      .insert({
        user_id: user.id,
        player_id: selectedPlayer.id,
        tournament_id: null,
        tournament_name: eventName,
      });

    if (error) {
      console.error('Error saving custom event registration:', error);
      return;
    }

    setRegistrations(prev => [...prev, { player_id: selectedPlayer.id, tournament_name: eventName, tournaments: null }]);
  };

  // Handle browser back button / gesture on mobile: closing the modal any
  // way (X, Cancel, backdrop, or back button) should consume exactly the one
  // history entry pushed on open. Kept independent of `onClose`'s identity
  // (which changes every parent render) so a parent re-render — e.g. from an
  // auth token refresh when switching tabs/windows — never tears this effect
  // down and spuriously triggers history.back().
  const pushedHistoryRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ modalOpen: true }, '');
    pushedHistoryRef.current = true;

    const handlePopState = () => {
      pushedHistoryRef.current = false;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);

  const handleClose = () => {
    // Close immediately so intentional closes (Save/X/Cancel/backdrop) never
    // wait on an async popstate round-trip; still pop the pushed history
    // entry in the background so the stack stays balanced for the physical
    // back button/gesture.
    const hadPushedHistory = pushedHistoryRef.current;
    pushedHistoryRef.current = false;
    onClose();
    if (hadPushedHistory) {
      window.history.back();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await onSave({
        date: formData.date,
        player_name: formData.player_name,
        tournament_name: formData.tournament_name,
        event_details: formData.tournament_name + (formData.event_details ? '-' + formData.event_details : ''),
        score: formData.score,
        classement: formData.classement,
        impressions: {
          forehand: formData.forehand,
          backhand: formData.backhand,
          serve: formData.serve,
          return: formData.return,
        },
        comments: formData.comments,
        scoring_history: formData.scoring_history,
        game_per_set: formData.game_per_set,
        super_tiebreak: formData.super_tiebreak,
        no_ad: formData.no_ad,
      });
      if (isAddingCustomEvent && formData.tournament_name.trim()) {
        await saveCustomEventRegistration(formData.player_name, formData.tournament_name.trim());
      }
      handleClose();
    } catch (error) {
      console.error('Error saving match:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const cycleImpression = (skill: 'forehand' | 'backhand' | 'serve' | 'return') => {
    const current = formData[skill];
    const next = current === 'bad' ? 'good' : current === 'good' ? 'great' : 'bad';
    setFormData(prev => ({ ...prev, [skill]: next }));
  };

  const getEmoji = (state: 'bad' | 'good' | 'great') => {
    switch (state) {
      case 'bad': return '👎';
      case 'good': return '😐';
      case 'great': return '👍';
    }
  };

  const getTitle = (state: 'bad' | 'good' | 'great') => {
    switch (state) {
      case 'bad': return 'Mauvais';
      case 'good': return 'Bon';
      case 'great': return 'Excellent';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4"
      onClick={handleClose}
    >
      <div
        className="bg-[#0a1628] md:rounded-xl shadow-xl w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:mx-4 transition-all duration-300 flex flex-col border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 flex-shrink-0">
          <h3 className="text-xl font-bold text-white">
            {editingMatch ? 'Modifier le match' : 'Ajouter un match'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="p-4 md:p-6 space-y-4 flex-1">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Date :
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Joueur :
              </label>
              <select
                value={formData.player_name}
                onChange={(e) => setFormData(prev => ({ ...prev, player_name: e.target.value }))}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                required
              >
                <option value="" class="bg-[#0a1628] text-gray-300">Sélectionner un joueur</option>
                {players.map(player => {
                  const playerName = player.first_name;
                  return (
                    <option key={player.id} value={playerName} class="bg-[#0a1628] text-gray-300">{playerName}</option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Événement :
              </label>
              {isAddingCustomEvent ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={formData.tournament_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, tournament_name: e.target.value }))}
                    placeholder="Nom de l'événement"
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomEvent(false);
                      setFormData(prev => ({ ...prev, tournament_name: '' }));
                    }}
                    className="px-3 text-gray-400 hover:text-white border border-white/10 rounded-lg transition-colors"
                    title="Revenir à la liste"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <select
                    value={formData.tournament_name}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsAddingCustomEvent(true);
                        setFormData(prev => ({ ...prev, tournament_name: '' }));
                      } else {
                        setFormData(prev => ({ ...prev, tournament_name: e.target.value }));
                      }
                    }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                    required
                  >
                    <option value="" className="bg-[#0a1628] text-gray-300">Sélectionner un événement</option>
                    {formData.tournament_name && !playerEvents.some(e => e.label === formData.tournament_name) && (
                      <option value={formData.tournament_name} className="bg-[#0a1628] text-gray-300">{formData.tournament_name}</option>
                    )}
                    {playerEvents.map(event => (
                      <option key={event.key} value={event.label} className="bg-[#0a1628] text-gray-300">
                        {event.label}
                      </option>
                    ))}
                    <option value="__add_new__" className="bg-[#0a1628] text-[#C8F135]">+ Ajouter un événement</option>
                  </select>
                  {playerEvents.length === 0 && formData.player_name && formData.date && (
                    <p className="mt-2 text-sm text-gray-400">
                      Aucun événement enregistré pour {formData.player_name} à cette date. Utilisez « + Ajouter un événement » pour en saisir un.
                    </p>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Détails de l'événement (optionnel) :
              </label>
              <input
                type="text"
                value={formData.event_details}
                onChange={(e) => setFormData(prev => ({ ...prev, event_details: e.target.value }))}
                placeholder="ex: Tableau principal, R1"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-400">
                Cette information sera ajoutée à l'événement sélectionné
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Score :
              </label>
              <input
                type="text"
                value={formData.score}
                onChange={(e) => setFormData(prev => ({ ...prev, score: e.target.value }))}
                placeholder="6/3 - 4/6 - 10/7"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Classement :
              </label>
              <select
                value={formData.classement}
                onChange={(e) => setFormData(prev => ({ ...prev, classement: e.target.value as 'NC' | '40' | '30' | '15' }))}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                required
              >
                <option value="NC" class="bg-[#0a1628] text-gray-300">NC</option>
                <option value="40" class="bg-[#0a1628] text-gray-300">40</option>
                <option value="30/5" class="bg-[#0a1628] text-gray-300">30/5</option>
                <option value="30/4" class="bg-[#0a1628] text-gray-300">30/4</option>
                <option value="30/3" class="bg-[#0a1628] text-gray-300">30/3</option>
                <option value="30/2" class="bg-[#0a1628] text-gray-300">30/2</option>
                <option value="30/1" class="bg-[#0a1628] text-gray-300">30/1</option>
                <option value="30" class="bg-[#0a1628] text-gray-300">30</option>
                <option value="15/5" class="bg-[#0a1628] text-gray-300">15/5</option>
                <option value="15/4" class="bg-[#0a1628] text-gray-300">15/4</option>
                <option value="15/3" class="bg-[#0a1628] text-gray-300">15/3</option>
                <option value="15/2" class="bg-[#0a1628] text-gray-300">15/2</option>
                <option value="15/1" class="bg-[#0a1628] text-gray-300">15/1</option>
                <option value="15" class="bg-[#0a1628] text-gray-300">15</option>
                <option value="5/6" class="bg-[#0a1628] text-gray-300">5/6</option>
                <option value="4/6" class="bg-[#0a1628] text-gray-300">4/6</option>
                <option value="3/6" class="bg-[#0a1628] text-gray-300">3/6</option>
                <option value="2/6" class="bg-[#0a1628] text-gray-300">2/6</option>
                <option value="1/6" class="bg-[#0a1628] text-gray-300">1/6</option>
                <option value="0" class="bg-[#0a1628] text-gray-300">0</option>
                <option value="-2/6" class="bg-[#0a1628] text-gray-300">-2/6</option>
                <option value="-15" class="bg-[#0a1628] text-gray-300">-15</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-3">
                Impressions :
              </label>
              <div className="grid grid-cols-2 gap-4">
                {(['forehand', 'backhand', 'serve', 'return'] as const).map((skill) => (
                  <div key={skill} className="flex flex-col items-center">
                    <label className="text-xs font-medium text-gray-400 mb-2 uppercase">
                      {skill === 'forehand' ? 'Coup Droit' : skill === 'backhand' ? 'Revers' : skill === 'serve' ? 'Service' : 'Retour'}
                    </label>
                    <button
                      type="button"
                      onClick={() => cycleImpression(skill)}
                      className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl transition-all shadow-md hover:shadow-lg ${
                        formData[skill] === 'bad'
                          ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50'
                          : formData[skill] === 'good'
                          ? 'bg-white/10 hover:bg-white/20 border border-white/20'
                          : 'bg-[#C8F135]/20 hover:bg-[#C8F135]/30 border border-[#C8F135]/50'
                      }`}
                      title={getTitle(formData[skill])}
                    >
                      {getEmoji(formData[skill])}
                    </button>
                    <span className="text-xs text-gray-400 mt-1">
                      {getTitle(formData[skill])}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Commentaires :
              </label>
              <textarea
                value={formData.comments}
                onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                placeholder="Ajoutez des notes sur votre match..."
                rows={3}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-transparent resize-none"
              />
            </div>
          </div>

          <div className="flex-shrink-0 bg-[#0a1628] border-t border-white/10 p-4 md:p-6 flex items-center justify-end gap-3 shadow-lg">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-white hover:bg-white/10 rounded-lg transition-colors font-medium border border-white/10"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-[#C8F135] text-black rounded-lg hover:bg-[#d4f54a] transition-colors font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Sauvegarde...' : editingMatch ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
