import { useState, useEffect } from 'react';
import { supabase, MatchResult } from '../lib/supabase';
import { Loader2, Trophy, Calendar, MapPin, BarChart3 } from 'lucide-react';
import { MatchStatsModal } from '../components/MatchStatsModal';
import { FinalScoreboard } from '../components/FinalScoreboard';

type MatchHistoryPageProps = {
  matchId: string;
};

export function MatchHistoryPage({ matchId }: MatchHistoryPageProps) {
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  useEffect(() => {
    loadMatch();
  }, [matchId]);

  const loadMatch = async () => {
    setLoading(true);
    setError(null);

    try {
      // Read through the RPC rather than the table: match_results is not
      // readable by anonymous visitors, and this link is public.
      const { data, error: fetchError } = await supabase
        .rpc('get_public_match_result', { p_match_id: matchId });

      if (fetchError) {
        console.error('Error fetching match:', fetchError);
        setError('Match introuvable');
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Match introuvable');
        setLoading(false);
        return;
      }

      setMatch(data as MatchResult);
    } catch (err) {
      console.error('Error loading match:', err);
      setError('Erreur lors du chargement du match');
    } finally {
      setLoading(false);
    }
  };

  const renderEmoji = (mood: 'bad' | 'good' | 'great') => {
    switch (mood) {
      case 'great':
        return <span className="text-4xl" title="Excellent">👍</span>;
      case 'good':
        return <span className="text-4xl" title="Bon">😐</span>;
      case 'bad':
        return <span className="text-4xl" title="Mauvais">👎</span>;
    }
  };

  const getMatchResult = (score: string) => {
    if (!score) return 'unknown';

    const sets = score.split(' - ');
    let playerSets = 0;
    let opponentSets = 0;

    sets.forEach(set => {
      const cleanSet = set.replace(/\s*\(.*?\)\s*/g, '');
      const [player, opponent] = cleanSet.split('/').map(Number);
      if (player > opponent) {
        playerSets++;
      } else if (opponent > player) {
        opponentSets++;
      }
    });

    if (playerSets > opponentSets) return 'win';
    if (opponentSets > playerSets) return 'loss';
    return 'unknown';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#050d1a] via-[#071428] to-[#050d1a] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#C8F135] animate-spin" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#050d1a] via-[#071428] to-[#050d1a] flex items-center justify-center p-4">
        <div className="bg-[#0a1526] border border-white/10 rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <Trophy className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Match introuvable</h2>
          <p className="text-gray-400">
            Le match que vous recherchez n'existe pas ou n'est plus disponible.
          </p>
        </div>
      </div>
    );
  }

  const matchResult = getMatchResult(match.score);
  const isWin = matchResult === 'win';

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 bg-transparent">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between h-16 lg:h-20">
          <a href="#home" className="flex items-center gap-2 group shrink-0">
            <div className="relative w-7 h-7">
              <div className="absolute inset-0 rounded-full bg-[#C8F135] group-hover:scale-110 transition-transform duration-300"></div>
              <div className="absolute inset-[2px] rounded-full border-2 border-[#040c1a]/40"></div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-px h-full bg-[#040c1a]/30 rotate-45"></div>
              </div>
            </div>
            <span className="text-white font-bold text-base tracking-tight">myTenni<span className="text-[#C8F135]">Stats</span></span>
          </a>
        </div>
      </nav>
      <div className="min-h-screen bg-gradient-to-br from-[#050d1a] via-[#071428] to-[#050d1a] pt-20 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#0a1526] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className={`p-6 sm:p-8 border-b ${isWin ? 'bg-gradient-to-r from-green-500/20 to-green-600/20 border-green-500/30' : 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/30'}`}>
            <div className="flex items-center justify-center mb-4">
              <div className={`w-16 h-16 ${isWin ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'} rounded-full flex items-center justify-center border`}>
                <Trophy className={`w-8 h-8 ${isWin ? 'text-green-500' : 'text-red-500'}`} />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white text-center mb-2">
              Historique Résultats
            </h1>
            <p className={`text-center text-lg ${isWin ? 'text-green-400' : 'text-red-400'}`}>
              {isWin ? 'Victoire' : 'Défaite'}
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-[#C8F135]" />
                  <span className="text-sm font-semibold text-gray-400">Joueur</span>
                </div>
                <p className="text-xl font-bold text-white">{match.player_name}</p>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-[#C8F135]" />
                  <span className="text-sm font-semibold text-gray-400">Date</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {new Date(match.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/10 sm:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-[#C8F135]" />
                  <span className="text-sm font-semibold text-gray-400">Tournoi</span>
                </div>
                <p className="text-xl font-bold text-white">{match.tournament_name}</p>
                {match.event_details && (
                  <p className="text-sm text-gray-400 mt-1">{match.event_details}</p>
                )}
              </div>
            </div>

            <FinalScoreboard
              score={match.score}
              playerName={match.player_name}
              isWin={isWin}
              showWinnerIcon={true}
            />

            {match.comments && (
              <div className="bg-[#C8F135]/10 border-l-4 border-[#C8F135] p-4 rounded">
                <p className="text-sm text-gray-300 italic">
                  <span className="font-semibold text-white">Commentaires:</span> {match.comments}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Impressions</h3>
                <span className="px-3 py-1 bg-[#C8F135]/20 text-[#C8F135] text-sm font-semibold rounded-full border border-[#C8F135]/30">
                  {match.classement}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { key: 'forehand', label: 'Coup Droit' },
                  { key: 'backhand', label: 'Revers' },
                  { key: 'serve', label: 'Service' },
                  { key: 'return', label: 'Retour' }
                ].map(({ key, label }) => (
                  <div key={key} className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      {label}
                    </p>
                    <div className="flex items-center justify-center">
                      {renderEmoji(match.impressions[key as keyof typeof match.impressions])}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {match.scoring_history && match.scoring_history.length > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={() => setIsStatsModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-[#C8F135] text-black rounded-lg font-bold hover:bg-[#d4f54a] transition-colors shadow-md"
                >
                  <BarChart3 className="w-5 h-5" />
                  Voir les statistiques détaillées
                </button>
              </div>
            )}
          </div>

          <div className="bg-[#0f1e35] px-6 sm:px-8 py-4 border-t border-[#C8F135]/20">
            <p className="text-center text-sm text-gray-400">
              Shared Match History
            </p>
          </div>
        </div>
      </div>

      <MatchStatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        match={match}
      />
    </div>
    </>
  );
}
