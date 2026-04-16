import { useState, useMemo } from 'react';
import { X, Share2, Check } from 'lucide-react';
import { MatchResult, supabase } from '../lib/supabase';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAlert } from '../hooks/useAlert';

type ShareMatchResultsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  matchResults: MatchResult[];
};

export function ShareMatchResultsModal({ isOpen, onClose, matchResults }: ShareMatchResultsModalProps) {
  const { canShareMatch, incrementUsage } = useSubscription();
  const { showAlert, AlertComponent } = useAlert();
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const uniquePlayers = useMemo(() => {
    const players = new Set<string>();
    matchResults.forEach(match => {
      players.add(match.player_name);
    });
    return Array.from(players).sort();
  }, [matchResults]);

  const handleTogglePlayer = (playerName: string) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerName)) {
        return prev.filter(p => p !== playerName);
      } else {
        return [...prev, playerName];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedPlayers.length === uniquePlayers.length) {
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers([...uniquePlayers]);
    }
  };

  const handleShare = async () => {
    if (selectedPlayers.length === 0) {
      showAlert('Veuillez sélectionner au moins un joueur');
      return;
    }

    if (!canShareMatch) {
      showAlert('You have reached your share limit on the Free plan. Upgrade to Premium for unlimited sharing!');
      return;
    }

    setIsCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showAlert('Vous devez être connecté pour partager');
        setIsCreating(false);
        return;
      }

      const filteredMatches = matchResults.filter(match =>
        selectedPlayers.includes(match.player_name)
      );

      const matchIds = filteredMatches.map(m => m.id);

      const { data, error } = await supabase
        .from('shared_match_results')
        .insert({
          user_id: user.id,
          player_names: selectedPlayers,
          match_results_ids: matchIds,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating share:', error);
        showAlert('Erreur lors de la création du lien de partage');
        setIsCreating(false);
        return;
      }

      await incrementUsage('share');

      const shareUrl = `${window.location.origin}/shared-results/${data.id}`;
      await navigator.clipboard.writeText(shareUrl);

      setSelectedPlayers([]);

      showAlert('Lien copié dans le presse-papiers! Partagez-le pour montrer les résultats des matchs.', {
        type: 'success',
        title: 'Partage créé',
        link: shareUrl,
        onClose: () => {
          onClose();
        }
      });
    } catch (error) {
      console.error('Error sharing results:', error);
      showAlert('Erreur lors du partage');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AlertComponent />
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a1628] rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#C8F135]/20 rounded-lg flex items-center justify-center border border-[#C8F135]/30">
                <Share2 className="w-5 h-5 text-[#C8F135]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Partager les Résultats</h3>
                <p className="text-sm text-gray-400">Sélectionner les joueurs à partager</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <button
              onClick={handleSelectAll}
              className="text-sm font-medium text-[#C8F135] hover:text-[#d4f54a] transition-colors"
            >
              {selectedPlayers.length === uniquePlayers.length ? 'Désélectionner tout' : 'Sélectionner tout'}
            </button>
          </div>

          <div className="space-y-2">
            {uniquePlayers.map((playerName) => {
              const playerMatches = matchResults.filter(m => m.player_name === playerName);
              const isSelected = selectedPlayers.includes(playerName);

              return (
                <button
                  key={playerName}
                  onClick={() => handleTogglePlayer(playerName)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? 'border-[#C8F135] bg-[#C8F135]/10'
                      : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-[#C8F135] bg-[#C8F135]'
                            : 'border-gray-500'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-black" />}
                        </div>
                        <p className="font-semibold text-white">{playerName}</p>
                      </div>
                      <p className="text-sm text-gray-400 ml-7 mt-1">
                        {playerMatches.length} match{playerMatches.length > 1 ? 'es' : ''}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {uniquePlayers.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              Aucun joueur trouvé
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-[#0a1628]">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-white/10 rounded-lg text-white font-medium hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleShare}
              disabled={selectedPlayers.length === 0 || isCreating}
              className="flex-1 px-4 py-3 bg-[#C8F135] text-black rounded-lg font-bold hover:bg-[#d4f54a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Créer le lien ({selectedPlayers.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
