import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Trophy, RefreshCw, X } from 'lucide-react';
import { MatchHistoryDisplay } from '../components/MatchHistoryDisplay';
import { LiveMatchStats } from '../components/LiveMatchStats';

type GameScore = { adversaire: number; famille: number };
type SetScores = { adversaire: number[]; famille: number[] };
type GameFormat = {
  threeGames: boolean;
  fourGames: boolean;
  supertiebreak: boolean;
  noAd: boolean;
};

type LiveMatch = {
  id: string;
  player_name: string;
  game_score: GameScore;
  set_scores: SetScores;
  current_set: number;
  is_tiebreak: boolean;
  is_finished: boolean;
  current_server: 'famille' | 'adversaire';
  game_format: GameFormat;
  scoring_history: any[];
  updated_at: string;
};

export function LiveMatchPage({ matchId }: { matchId: string }) {
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    loadMatch();

    const channel = supabase
      .channel(`live-match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const newMatch = payload.new as LiveMatch;
          if (newMatch && newMatch.scoring_history) {
            newMatch.scoring_history = newMatch.scoring_history.sort((a: any, b: any) => {
              if (a.sequence !== undefined && b.sequence !== undefined) {
                return a.sequence - b.sequence;
              }
              if (a.timestampMs && b.timestampMs) {
                return a.timestampMs - b.timestampMs;
              }
              return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            });
          }
          setMatch(newMatch);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadMatch();
    }, 15000);

    return () => clearInterval(interval);
  }, [autoRefresh, matchId]);

  const loadMatch = async () => {
    const { data, error } = await supabase
      .from('live_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (error) {
      setError('Match non trouvé');
      setLoading(false);
      return;
    }

    if (data && data.scoring_history) {
      data.scoring_history = data.scoring_history.sort((a: any, b: any) => {
        if (a.sequence !== undefined && b.sequence !== undefined) {
          return a.sequence - b.sequence;
        }
        if (a.timestampMs && b.timestampMs) {
          return a.timestampMs - b.timestampMs;
        }
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
    }

    setMatch(data);
    setLoading(false);
  };

  const getDisplayScore = (score: number) => {
    if (match?.is_tiebreak) return score.toString();
    const scores = ['0', '15', '30', '40', 'A'];
    return scores[score] || score.toString();
  };

  const calculateMatchStatus = () => {
    if (!match) return { isFinished: false, setsToShow: 3 };

    const familleSetsWon = match.set_scores.famille.filter((score, idx) => {
      const opponentScore = match.set_scores.adversaire[idx];
      return score > opponentScore;
    }).length;

    const adversaireSetsWon = match.set_scores.adversaire.filter((score, idx) => {
      const familleScore = match.set_scores.famille[idx];
      return score > familleScore;
    }).length;

    const isFinished = familleSetsWon >= 2 || adversaireSetsWon >= 2 || match.is_finished;

    const totalSetsPlayed = match.set_scores.famille.filter((score, idx) =>
      score > 0 || match.set_scores.adversaire[idx] > 0
    ).length;

    const setsToShow = Math.max(isFinished ? totalSetsPlayed : 3, 2);

    return { isFinished, setsToShow, familleSetsWon, adversaireSetsWon };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1e35] to-[#0a0e1a]">
        <Loader2 className="w-12 h-12 text-[#C8F135] animate-spin" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1e35] to-[#0a0e1a]">
        <div className="text-center">
          <p className="text-xl font-semibold text-white mb-2">Match non disponible</p>
          <p className="text-gray-400">Ce match n'existe pas ou a expiré.</p>
        </div>
      </div>
    );
  }

  const matchStatus = calculateMatchStatus();

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
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1e35] to-[#0a0e1a] pt-20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/10">
          <div className="bg-gradient-to-r from-[#C8F135]/20 to-[#C8F135]/10 text-white px-6 py-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex-1" />
              <div className="text-center flex-1">
                <h2 className="text-2xl md:text-3xl font-bold flex items-center justify-center gap-3 text-white">
                  <Trophy className="w-6 h-6 md:w-8 md:h-8 text-[#C8F135]" />
                  Match en Direct
                  <Trophy className="w-6 h-6 md:w-8 md:h-8 text-[#C8F135]" />
                </h2>
                {matchStatus.isFinished && (
                  <p className="mt-2 text-[#C8F135] text-sm font-semibold">
                    Match terminé - {matchStatus.familleSetsWon} set{matchStatus.familleSetsWon > 1 ? 's' : ''} à {matchStatus.adversaireSetsWon}
                  </p>
                )}
              </div>
              <div className="flex-1 flex justify-end">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg font-medium transition-all ${
                    autoRefresh
                      ? 'bg-[#C8F135] text-black shadow-lg'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                  title={autoRefresh ? 'Désactiver le rafraîchissement automatique' : 'Activer le rafraîchissement automatique'}
                >
                  <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                  <span className="text-sm">{autoRefresh ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8">
            <div className="bg-gradient-to-br from-[#0f1e35]/50 to-[#0a1628]/50 rounded-xl p-4 md:p-6 shadow-inner border border-white/5">
              <table className="w-full bg-white/5 backdrop-blur-sm rounded-lg shadow-sm overflow-hidden border border-white/10">
                <tbody>
                  <tr className="border-b border-white/10">
                    <td className="px-2 md:px-4 py-3 text-sm md:text-base font-semibold text-gray-200 bg-white/5">
                      <div className="flex items-center gap-2">
                        <span className="truncate">Adversaire</span>
                        {!matchStatus.isFinished && match.current_server === 'adversaire' && (
                          <img src="/tennis-ball.svg" alt="Service" className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                        )}
                      </div>
                    </td>
                    {Array.from({ length: matchStatus.setsToShow }, (_, i) => i).map((setNum) => (
                      <td
                        key={setNum}
                        className={`px-2 md:px-3 py-3 text-center font-bold text-base md:text-lg ${
                          !matchStatus.isFinished && setNum === match.current_set ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'
                        }`}
                      >
                        {match.set_scores.adversaire[setNum] || 0}
                      </td>
                    ))}
                    {!matchStatus.isFinished && (
                      <td className="px-2 md:px-4 py-3 text-center font-bold text-xl md:text-2xl bg-red-500/20 text-red-400">
                        {getDisplayScore(match.game_score.adversaire)}
                      </td>
                    )}
                  </tr>
                  <tr>
                    <td className="px-2 md:px-4 py-3 text-sm md:text-base font-semibold text-gray-200 bg-white/5">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{match.player_name}</span>
                        {!matchStatus.isFinished && match.current_server === 'famille' && (
                          <img src="/tennis-ball.svg" alt="Service" className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                        )}
                      </div>
                    </td>
                    {Array.from({ length: matchStatus.setsToShow }, (_, i) => i).map((setNum) => (
                      <td
                        key={setNum}
                        className={`px-2 md:px-3 py-3 text-center font-bold text-base md:text-lg ${
                          !matchStatus.isFinished && setNum === match.current_set ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'
                        }`}
                      >
                        {match.set_scores.famille[setNum] || 0}
                      </td>
                    ))}
                    {!matchStatus.isFinished && (
                      <td className="px-2 md:px-4 py-3 text-center font-bold text-xl md:text-2xl bg-green-500/20 text-green-400">
                        {getDisplayScore(match.game_score.famille)}
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <div className="text-center mb-4">
                {!matchStatus.isFinished && (
                  <p className="text-sm text-gray-400">
                    {match.is_tiebreak ? 'Jeu décisif en cours' : `Set ${match.current_set + 1}`}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Dernière mise à jour: {new Date(match.updated_at).toLocaleTimeString('fr-FR')}
                </p>
              </div>

              {match.scoring_history && match.scoring_history.length > 0 && (
                <>
                  <div className="mb-6">
                    <LiveMatchStats scoringHistory={match.scoring_history} />
                  </div>

                  <MatchHistoryDisplay
                    scoringHistory={match.scoring_history}
                    playerName={match.player_name}
                    onPlayVideo={(url) => setPlayingVideoUrl(url)}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>
            {autoRefresh
              ? 'Rafraîchissement automatique activé (toutes les 15 secondes)'
              : 'Rafraîchissement automatique désactivé - Cliquez sur le bouton pour activer'}
          </p>
        </div>
      </div>

      {playingVideoUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[100] p-4" onClick={() => setPlayingVideoUrl(null)}>
          <div className="bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Vidéo du point</h3>
              <button
                onClick={() => setPlayingVideoUrl(null)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="bg-black rounded-lg">
              <video
                src={playingVideoUrl}
                controls
                controlsList="nodownload"
                autoPlay
                playsInline
                className="w-full rounded-lg max-h-[70vh]"
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
