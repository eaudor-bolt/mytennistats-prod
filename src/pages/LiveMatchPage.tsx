import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Trophy, RefreshCw } from 'lucide-react';
import { MatchHistoryDisplay } from '../components/MatchHistoryDisplay';
import { LiveMatchStats } from '../components/LiveMatchStats';
import { VideoPlayerModal } from '../components/VideoPlayerModal';

type GameScore = { adversaire: number; famille: number };
type SetScores = { adversaire: number[]; famille: number[] };
type GameFormat = {
  threeGames: boolean;
  fourGames: boolean;
  fiveGames?: boolean;
  sixGames?: boolean;
  supertiebreak: boolean;
  noAd: boolean;
  tiebreakAt?: number;
  formatPreset?: number;
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
  const viewCountedRef = useRef(false);

  useEffect(() => {
    loadMatch();

    // Count this as one "view" of the shared link - once per page load, not
    // once per poll/realtime update, and not tied to whether the fetch above
    // succeeds (a load error doesn't mean the link wasn't opened).
    if (!viewCountedRef.current) {
      viewCountedRef.current = true;
      supabase.rpc('increment_live_match_views', { p_match_id: matchId })
        .then(({ error }) => { if (error) console.error('Error recording view:', error); });
    }

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
    // live_matches is not readable by anonymous visitors; the RPC returns the
    // single match for this id. This polling path is also what keeps the page
    // fresh for logged-out viewers, since the Realtime subscription above only
    // delivers rows the subscriber can read under RLS (i.e. the owner's own).
    const { data, error } = await supabase
      .rpc('get_live_match', { p_match_id: matchId });

    if (error || !data) {
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

  const detectTiebreakSets = () => {
    if (!match) return {};
    const tiebreaks: Record<number, { adversaire: number; famille: number }> = {};
    const history = match.scoring_history || [];

    for (let setIdx = 0; setIdx < 3; setIdx++) {
      const advScore = match.set_scores.adversaire[setIdx];
      const famScore = match.set_scores.famille[setIdx];
      // A tiebreak set has one player at 7 (or 3 in 3-game, 4 in 4-game, 5 in 5-game)
      const isThreeGame = match.game_format?.threeGames;
      const isFourGame = match.game_format?.fourGames;
      const isFiveGame = match.game_format?.fiveGames;
      const tiebreakAt = match.game_format?.tiebreakAt;

      let tiebreakWinScore = 7;
      let tiebreakLoseScore = 6;
      if (tiebreakAt && tiebreakAt > 0) {
        tiebreakWinScore = tiebreakAt + 1;
        tiebreakLoseScore = tiebreakAt;
      } else if (isThreeGame) { tiebreakWinScore = 3; tiebreakLoseScore = 2; }
      else if (isFourGame) { tiebreakWinScore = 4; tiebreakLoseScore = 3; }
      else if (isFiveGame) { tiebreakWinScore = 5; tiebreakLoseScore = 4; }

      if ((advScore === tiebreakWinScore && famScore === tiebreakLoseScore) ||
          (famScore === tiebreakWinScore && advScore === tiebreakLoseScore)) {
        // Find the tiebreak points from scoring history for this set
        const tiebreakPoints = history.filter((p: any) => p.currentSet === setIdx && p.isTiebreak);
        if (tiebreakPoints.length > 0) {
          const lastTbPoint = tiebreakPoints[tiebreakPoints.length - 1];
          if (lastTbPoint.gameScore) {
            // The game score at end = the loser's tiebreak score
            const advTb = lastTbPoint.gameScore.adversaire || 0;
            const famTb = lastTbPoint.gameScore.famille || 0;
            // The winner scored one more
            if (advScore === tiebreakWinScore) {
              tiebreaks[setIdx] = { adversaire: advTb + 1, famille: famTb };
            } else {
              tiebreaks[setIdx] = { adversaire: advTb, famille: famTb + 1 };
            }
          }
        } else {
          // Fallback: use tiebreakLoseScore as the loser's tb score display
          if (advScore === tiebreakWinScore) {
            tiebreaks[setIdx] = { adversaire: 7, famille: tiebreakLoseScore };
          } else {
            tiebreaks[setIdx] = { adversaire: tiebreakLoseScore, famille: 7 };
          }
        }
      }
    }
    return tiebreaks;
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
      <div className="flex items-center justify-center min-h-screen bg-[#050d1a]">
        <Loader2 className="w-12 h-12 text-[#C8F135] animate-spin" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050d1a]">
        <div className="text-center">
          <p className="text-xl font-semibold text-white mb-2">Match non disponible</p>
          <p className="text-gray-400">Ce match n'existe pas ou a expir&eacute;.</p>
        </div>
      </div>
    );
  }

  const matchStatus = calculateMatchStatus();
  const tiebreakScores = detectTiebreakSets();
  const isSupertiebreakSet = match.game_format?.supertiebreak && match.current_set === 2;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050d1a]/80 backdrop-blur-md border-b border-white/5">
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

      <div className="min-h-screen bg-[#050d1a] pt-20 pb-12">
        {/* Hero */}
        <section className="relative pt-8 pb-6 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[600px] h-[300px] bg-[#1A6FC4]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[400px] bg-[#C8F135]/5 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-[#C8F135]" />
                  <span className="text-[#C8F135] text-sm font-medium tracking-widest uppercase">
                    Live
                  </span>
                </div>
                <h1 className="text-3xl lg:text-5xl font-black text-white leading-tight tracking-tight">
                  Match en <span className="text-[#C8F135]">Direct</span>
                </h1>
                {matchStatus.isFinished && (
                  <p className="mt-2 text-[#C8F135] text-sm font-semibold">
                    Match termin&eacute; - {matchStatus.familleSetsWon} set{(matchStatus.familleSetsWon || 0) > 1 ? 's' : ''} &agrave; {matchStatus.adversaireSetsWon}
                  </p>
                )}
              </div>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg font-medium transition-all ${
                  autoRefresh
                    ? 'bg-[#C8F135] text-black shadow-lg shadow-[#C8F135]/20'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                }`}
                title={autoRefresh ? 'Désactiver le rafraîchissement' : 'Activer le rafraîchissement'}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                <span className="text-sm hidden sm:inline">{autoRefresh ? 'Auto' : 'OFF'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Scoreboard */}
        <section className="relative pb-8">
          <div className="max-w-4xl mx-auto px-6 lg:px-10">
            <div className="bg-gradient-to-br from-[#0f1e35]/50 to-[#0a1628]/50 rounded-xl p-2 sm:p-4 shadow-inner border border-white/5">
              <div className="flex items-center justify-center">
                <div className="flex-1 min-w-0">
                  <table className="w-full bg-white/5 backdrop-blur-sm rounded-lg shadow-sm overflow-hidden border border-white/10">
                    <tbody>
                      {/* Adversaire row */}
                      <tr className="border-b border-white/10">
                        <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-200 bg-white/5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                              <span className="truncate">Adversaire</span>
                              {!matchStatus.isFinished && match.current_server === 'adversaire' && (
                                <img src="/tennis-ball.svg" alt="Serving" className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                              )}
                            </div>
                            {!matchStatus.isFinished && (
                              <div className="flex items-center gap-1">
                                <span className="w-10 h-6 sm:w-12 sm:h-7 flex items-center justify-center bg-red-500 text-white text-xs sm:text-sm font-bold rounded shadow flex-shrink-0">
                                  {getDisplayScore(match.game_score.adversaire)}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        {Array.from({ length: matchStatus.setsToShow }, (_, i) => i).map((setNum) => (
                          <td
                            key={setNum}
                            className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-sm sm:text-base font-bold ${
                              !matchStatus.isFinished && setNum === match.current_set ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'
                            }`}
                          >
                            {match.set_scores.adversaire[setNum] || 0}
                            {tiebreakScores[setNum] && !(setNum === 2 && match.game_format?.supertiebreak) && (
                              <sup className="text-xs">
                                {Math.min(tiebreakScores[setNum].adversaire, tiebreakScores[setNum].famille)}
                              </sup>
                            )}
                          </td>
                        ))}
                      </tr>
                      {/* Player row */}
                      <tr>
                        <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-200 bg-white/5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                              <span className="truncate">{match.player_name}</span>
                              {!matchStatus.isFinished && match.current_server === 'famille' && (
                                <img src="/tennis-ball.svg" alt="Serving" className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                              )}
                            </div>
                            {!matchStatus.isFinished && (
                              <div className="flex items-center gap-1">
                                <span className="w-10 h-6 sm:w-12 sm:h-7 flex items-center justify-center bg-green-500 text-white text-xs sm:text-sm font-bold rounded shadow flex-shrink-0">
                                  {getDisplayScore(match.game_score.famille)}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        {Array.from({ length: matchStatus.setsToShow }, (_, i) => i).map((setNum) => (
                          <td
                            key={setNum}
                            className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-sm sm:text-base font-bold ${
                              !matchStatus.isFinished && setNum === match.current_set ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'
                            }`}
                          >
                            {match.set_scores.famille[setNum] || 0}
                            {tiebreakScores[setNum] && !(setNum === 2 && match.game_format?.supertiebreak) && (
                              <sup className="text-xs">
                                {Math.min(tiebreakScores[setNum].adversaire, tiebreakScores[setNum].famille)}
                              </sup>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center">
              {!matchStatus.isFinished && (
                <p className="text-sm text-gray-400">
                  {match.is_tiebreak
                    ? isSupertiebreakSet ? 'Super tie-break en cours' : 'Jeu d&eacute;cisif en cours'
                    : `Set ${match.current_set + 1}`}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Derni&egrave;re mise &agrave; jour: {new Date(match.updated_at).toLocaleTimeString('fr-FR')}
              </p>
            </div>
          </div>
        </section>

        {/* Stats & History */}
        {match.scoring_history && match.scoring_history.length > 0 && (
          <section className="relative pb-12">
            <div className="max-w-4xl mx-auto px-6 lg:px-10 space-y-6">
              <LiveMatchStats scoringHistory={match.scoring_history} />
              <MatchHistoryDisplay
                scoringHistory={match.scoring_history}
                playerName={match.player_name}
                onPlayVideo={(url) => setPlayingVideoUrl(url)}
              />
            </div>
          </section>
        )}

        {/* Footer note */}
        <div className="max-w-4xl mx-auto px-6 lg:px-10 text-center text-gray-500 text-sm">
          <p>
            {autoRefresh
              ? 'Rafra\u00eechissement automatique activ\u00e9 (toutes les 15 secondes)'
              : 'Rafra\u00eechissement automatique d\u00e9sactiv\u00e9'}
          </p>
        </div>
      </div>

      {playingVideoUrl && (
        <VideoPlayerModal
          videoUrl={playingVideoUrl}
          onClose={() => setPlayingVideoUrl(null)}
          title="Video du point"
        />
      )}
    </>
  );
}
