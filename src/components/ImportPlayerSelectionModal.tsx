import { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

type UserPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  license_number: string;
};

type ImportPlayerSelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlayer: (playerId: string, playerName: string) => void;
};

export function ImportPlayerSelectionModal({ isOpen, onClose, onSelectPlayer }: ImportPlayerSelectionModalProps) {
  const [players, setPlayers] = useState<UserPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadPlayers();
    }
  }, [isOpen]);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_players')
        .select('*')
        .eq('user_id', user.id)
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error loading players:', error);
        return;
      }

      setPlayers(data || []);
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlayer = (player: UserPlayer) => {
    const playerName = `${player.first_name} ${player.last_name}`.trim();
    onSelectPlayer(player.id, playerName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Sélectionner le joueur</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Chargement des joueurs...
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">Aucun joueur enregistré.</p>
              <p className="text-sm">Ajoutez d'abord un joueur dans les paramètres.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleSelectPlayer(player)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all text-left"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {player.first_name} {player.last_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      Licence: {player.license_number}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
