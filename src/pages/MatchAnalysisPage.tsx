import { useState, useEffect, useRef } from 'react';
import { X, Play, ChevronLeft, Loader2, AlertCircle, Camera, Clock, CheckCircle, Star } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, RadialLinearScale, Filler } from 'chart.js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { InlineScoreboard } from '../components/InlineScoreboard';
import { VideoPlayerModal } from '../components/VideoPlayerModal';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, RadialLinearScale, Filler);

type MatchResult = {
  id: string;
  tournament_name: string;
  player_name: string;
  date: string;
  score: string;
  scoring_history: ScoringPoint[];
};

type ScoringPoint = {
  timestamp: string;
  player: 'famille' | 'adversaire';
  videoUrl?: string;
  gameScore: { famille: number; adversaire: number };
  setScores: { famille: number[]; adversaire: number[] };
  isTiebreak?: boolean;
  toggleValue?: string;
  duration?: number;
  sizeBytes?: number;
};

export function MatchAnalysisPage({ onClose, inline = false }: { onClose: () => void; inline?: boolean }) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [playingPoint, setPlayingPoint] = useState<ScoringPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shotTypeFilter, setShotTypeFilter] = useState<string | null>(null);
  const [pointImportanceFilter, setPointImportanceFilter] = useState<'breakPoints' | 'gamePoints' | 'setPoints' | null>(null);
  const [highlightedPointIndex, setHighlightedPointIndex] = useState<number | null>(null);
  const [favoriteVideos, setFavoriteVideos] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'order' | 'duration'>('order');

  const historyContainerRef = useRef<HTMLDivElement>(null);
  const pointRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    loadMatches();
    loadFavorites();
  }, [user]);

  const loadMatches = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('match_results')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;

      const matchesWithVideos = (data || []).filter((match) => {
        if (!match.scoring_history || !Array.isArray(match.scoring_history)) return false;
        return match.scoring_history.some((point: any) => point.videoUrl);
      });

      setMatches(matchesWithVideos);
    } catch (err) {
      console.error('Error loading matches:', err);
      setError('Erreur lors du chargement des matchs');
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('videos')
      .select('url')
      .eq('user_id', user.id)
      .eq('favorite', true);
    if (data) {
      setFavoriteVideos(new Set(data.map(v => v.url)));
    }
  };

  const toggleFavorite = async (videoUrl: string, point: ScoringPoint) => {
    if (!user || !selectedMatch) return;
    const isFav = favoriteVideos.has(videoUrl);

    if (isFav) {
      setFavoriteVideos(prev => { const next = new Set(prev); next.delete(videoUrl); return next; });
      await supabase.from('videos').update({ favorite: false }).eq('url', videoUrl).eq('user_id', user.id);
    } else {
      setFavoriteVideos(prev => new Set(prev).add(videoUrl));
      const { data: existing } = await supabase
        .from('videos')
        .select('id')
        .eq('url', videoUrl)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('videos').update({ favorite: true }).eq('id', existing.id);
      } else {
        await supabase.from('videos').insert({
          url: videoUrl,
          user_id: user.id,
          player_name: selectedMatch.player_name,
          shot_type: point.toggleValue?.split(': ')[0] || 'Other',
          taken_at: point.timestamp || selectedMatch.date,
          status: 'ready',
          favorite: true,
          size_bytes: point.sizeBytes ?? null,
          duration_seconds: point.duration ?? null,
        });
      }
    }
  };

  const getPointsWithVideos = (match: MatchResult) => {
    if (!match.scoring_history) return [];
    return match.scoring_history.filter((point) => point.videoUrl);
  };

  const isBreakPoint = (point: ScoringPoint, nextPoint?: ScoringPoint) => {
    const gameScore = point.gameScore;
    if (!gameScore || point.isTiebreak) return false;

    if (nextPoint) {
      const pointWinner = nextPoint.player;
      const wasGameWon = nextPoint.gameScore.famille === 0 && nextPoint.gameScore.adversaire === 0;

      if (wasGameWon) {
        return (pointWinner === 'famille' && gameScore.famille >= 3) ||
               (pointWinner === 'adversaire' && gameScore.adversaire >= 3);
      }
    }

    return (gameScore.famille === 4 && gameScore.adversaire < 3) ||
           (gameScore.adversaire === 4 && gameScore.famille < 3) ||
           (gameScore.famille >= 3 && gameScore.adversaire >= 3 && Math.abs(gameScore.famille - gameScore.adversaire) === 1);
  };

  const isGamePoint = (point: ScoringPoint, nextPoint?: ScoringPoint) => {
    const gameScore = point.gameScore;
    if (!gameScore || point.isTiebreak) return false;

    if (nextPoint) {
      const wasGameWon = nextPoint.gameScore.famille === 0 && nextPoint.gameScore.adversaire === 0;
      if (wasGameWon) {
        return (gameScore.famille === 4 && gameScore.adversaire < 3) ||
               (gameScore.adversaire === 4 && gameScore.famille < 3) ||
               (gameScore.famille >= 3 && gameScore.adversaire >= 3);
      }
    }

    return (gameScore.famille === 4 && gameScore.adversaire < 3) ||
           (gameScore.adversaire === 4 && gameScore.famille < 3) ||
           (gameScore.famille >= 3 && gameScore.adversaire >= 3 && Math.abs(gameScore.famille - gameScore.adversaire) === 1);
  };

  const isSetPoint = (point: ScoringPoint, nextPoint?: ScoringPoint) => {
    const setScores = point.setScores;
    const gameScore = point.gameScore;
    if (!setScores || !gameScore) return false;

    const currentSet = setScores.famille.length - 1;
    const familleGames = setScores.famille[currentSet] || 0;
    const adversaireGames = setScores.adversaire[currentSet] || 0;

    if (nextPoint) {
      const nextSetScores = nextPoint.setScores;
      if (nextSetScores && nextSetScores.famille.length > setScores.famille.length) {
        return true;
      }
    }

    const familleCanWinSet = familleGames >= 5 && familleGames >= adversaireGames;
    const adversaireCanWinSet = adversaireGames >= 5 && adversaireGames >= familleGames;

    if (familleCanWinSet || adversaireCanWinSet) {
      return isGamePoint(point, nextPoint);
    }

    return false;
  };

  const getFilteredPoints = (points: ScoringPoint[]) => {
    return points.filter((point, index) => {
      const nextPoint = index < points.length - 1 ? points[index + 1] : undefined;

      if (shotTypeFilter) {
        // toggleValue is stored as "<skill>: Gagne"/"<skill>: Faute" with the
        // English skill key used during Live Score (forehand/backhand/
        // volley/service/return/opponent) - never the French labels shown in
        // the UI, which is why matching against them never found anything.
        const toggleValue = point.toggleValue?.toLowerCase() || '';
        const skillKey = shotTypeFilter.toLowerCase() === 'serve' ? 'service' : shotTypeFilter.toLowerCase();
        if (!toggleValue.startsWith(`${skillKey}:`)) return false;
      }

      if (pointImportanceFilter) {
        if (pointImportanceFilter === 'breakPoints' && !isBreakPoint(point, nextPoint)) return false;
        if (pointImportanceFilter === 'gamePoints' && !isGamePoint(point, nextPoint)) return false;
        if (pointImportanceFilter === 'setPoints' && !isSetPoint(point, nextPoint)) return false;
      }

      return true;
    });
  };

  const getShotColor = (shot: string): string => {
    const colors: Record<string, string> = {
      forehand: '#22c55e',
      backhand: '#f97316',
      volley: '#3b82f6',
      serve: '#eab308',
      return: '#9ca3af',
      opponent: '#ef4444',
    };
    return colors[shot] || '#6b7280';
  };

  const toggleShotTypeFilter = (filter: string) => {
    setShotTypeFilter(prev => prev === filter ? null : filter);
  };

  const togglePointImportanceFilter = (filter: 'breakPoints' | 'gamePoints' | 'setPoints') => {
    setPointImportanceFilter(prev => prev === filter ? null : filter);
  };

  const scrollToPoint = (index: number) => {
    if (historyContainerRef.current && pointRefs.current[index]) {
      const container = historyContainerRef.current;
      const element = pointRefs.current[index];

      if (element) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const offset = elementRect.top - containerRect.top - (containerRect.height / 2) + (elementRect.height / 2);

        container.scrollTo({
          top: container.scrollTop + offset,
          behavior: 'smooth'
        });
      }
    }
  };

  const formatTimestamp = (timestamp: string | number) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}:${minutes}:${seconds}`;
  };

  const getTennisScore = (score: number, isTiebreak: boolean) => {
    if (isTiebreak) return score.toString();
    const tennisScores = ['0', '15', '30', '40'];
    if (score >= 4) return 'AD';
    return tennisScores[score] || '0';
  };

  if (!selectedMatch) {
    return (
      <div className={inline ? "" : "fixed inset-0 bg-slate-900 z-50 overflow-hidden"}>
        <div className={inline ? "" : "h-full flex flex-col"}>
          {!inline && (
            <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Analyse de Match</h1>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-white"
              >
                <X size={24} />
              </button>
            </div>
          )}

          <div className={inline ? "" : "flex-1 overflow-auto p-6"}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <p className="text-white text-lg">{error}</p>
                </div>
              </div>
            ) : matches.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-white text-lg">Aucun match avec vidéos trouvé</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map((match) => {
                  const videosCount = getPointsWithVideos(match).length;
                  return (
                    <div
                      key={match.id}
                      onClick={() => setSelectedMatch(match)}
                      className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-green-600 cursor-pointer transition-all hover:scale-105 hover:shadow-xl"
                    >
                      <h3 className="text-xl font-bold text-white mb-2">
                        {match.tournament_name}
                      </h3>
                      <p className="text-slate-300 mb-1">{match.player_name}</p>
                      <p className="text-slate-400 text-sm mb-3">
                        {new Date(match.date).toLocaleDateString('fr-FR')}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-green-500 font-bold text-lg">{match.score}</p>
                        <p className="text-slate-400 text-sm">{videosCount} vidéos</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const pointsWithVideos = getPointsWithVideos(selectedMatch);
  const filteredPoints = getFilteredPoints(pointsWithVideos);
  const displayedPoints = sortBy === 'duration'
    ? [...filteredPoints].sort((a, b) => parseFloat(String(a.duration ?? 0)) - parseFloat(String(b.duration ?? 0)))
    : filteredPoints;

  return (
    <>
    <div className={inline ? "" : "fixed inset-0 bg-slate-900 z-50 overflow-hidden"}>
      <div className={inline ? "" : "h-full flex flex-col"}>
        <div className={inline ? "mb-4" : "bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between"}>
          <div>
            <button
              onClick={() => setSelectedMatch(null)}
              className="text-slate-400 hover:text-white mb-2 flex items-center gap-2"
            >
              <ChevronLeft size={20} />
              Retour aux matchs
            </button>
            <h1 className="text-2xl font-bold text-white">{selectedMatch.tournament_name}</h1>
            <p className="text-slate-300">{selectedMatch.player_name} - {selectedMatch.score}</p>
          </div>
          {!inline && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-white"
            >
              <X size={24} />
            </button>
          )}
        </div>

        <div className={inline ? "" : "flex-1 overflow-auto p-6"}>
          <div className="mb-4 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Type de Coup</h3>
              <div className="flex flex-wrap gap-2">
                {(['forehand', 'backhand', 'serve', 'return', 'volley', 'smash'] as const).map(shot => {
                  const color = getShotColor(shot);
                  const isSelected = shotTypeFilter === shot;
                  return (
                    <button
                      key={shot}
                      onClick={() => toggleShotTypeFilter(shot)}
                      className={`px-4 py-2 rounded-lg font-medium border transition-all duration-150 ${
                        isSelected
                          ? 'text-white shadow-inner scale-95 ring-2 ring-white/70'
                          : 'text-white hover:brightness-125'
                      }`}
                      style={{
                        backgroundColor: isSelected ? color : `${color}4D`,
                        borderColor: color,
                        boxShadow: isSelected ? `0 4px 12px ${color}30` : undefined,
                      }}
                    >
                      {shot === 'forehand' && 'Coup Droit'}
                      {shot === 'backhand' && 'Revers'}
                      {shot === 'serve' && 'Service'}
                      {shot === 'return' && 'Retour'}
                      {shot === 'volley' && 'Volée'}
                      {shot === 'smash' && 'Smash'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Points Importants</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => togglePointImportanceFilter('breakPoints')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    pointImportanceFilter === 'breakPoints'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Break Points ({pointsWithVideos.filter((p, i) => isBreakPoint(p, pointsWithVideos[i + 1])).length})
                </button>
                <button
                  onClick={() => togglePointImportanceFilter('gamePoints')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    pointImportanceFilter === 'gamePoints'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Game Points ({pointsWithVideos.filter((p, i) => isGamePoint(p, pointsWithVideos[i + 1])).length})
                </button>
                <button
                  onClick={() => togglePointImportanceFilter('setPoints')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    pointImportanceFilter === 'setPoints'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Set Points ({pointsWithVideos.filter((p, i) => isSetPoint(p, pointsWithVideos[i + 1])).length})
                </button>
              </div>
            </div>
          </div>

          {(() => {
            const breakPoints = pointsWithVideos.filter((p, i) => isBreakPoint(p, pointsWithVideos[i + 1]));
            const gamePoints = pointsWithVideos.filter((p, i) => isGamePoint(p, pointsWithVideos[i + 1]));
            const setPoints = pointsWithVideos.filter((p, i) => isSetPoint(p, pointsWithVideos[i + 1]));
            const totalPoints = pointsWithVideos.length;
            const pointsWon = pointsWithVideos.filter(p => p.player === 'famille' || p.toggleValue?.includes('Gagne')).length;
            const pointsLost = totalPoints - pointsWon;
            const breakPointsWon = breakPoints.filter(p => p.player === 'famille' || p.toggleValue?.includes('Gagne')).length;
            const gamePointsWon = gamePoints.filter(p => p.player === 'famille' || p.toggleValue?.includes('Gagne')).length;
            const setPointsWon = setPoints.filter(p => p.player === 'famille' || p.toggleValue?.includes('Gagne')).length;

            return (
              <>
                <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-4">Statistiques du Match</h3>
                  <div className="h-64">
                    <Bar
                      data={{
                        labels: ['Points Totaux', 'Break Points', 'Game Points', 'Set Points'],
                        datasets: [
                          {
                            label: 'Points Gagnés',
                            data: [pointsWon, breakPointsWon, gamePointsWon, setPointsWon],
                            backgroundColor: 'rgba(34, 197, 94, 0.8)',
                            borderColor: 'rgb(34, 197, 94)',
                            borderWidth: 2,
                          },
                          {
                            label: 'Points Perdus',
                            data: [pointsLost, breakPoints.length - breakPointsWon, gamePoints.length - gamePointsWon, setPoints.length - setPointsWon],
                            backgroundColor: 'rgba(239, 68, 68, 0.8)',
                            borderColor: 'rgb(239, 68, 68)',
                            borderWidth: 2,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'top' as const,
                            labels: { color: '#e2e8f0', font: { size: 12, weight: 'bold' } },
                          },
                          tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#e2e8f0',
                            bodyColor: '#e2e8f0',
                            borderColor: '#475569',
                            borderWidth: 1,
                          },
                        },
                        scales: {
                          x: {
                            grid: { color: 'rgba(71, 85, 105, 0.3)' },
                            ticks: { color: '#cbd5e1', font: { size: 11 } },
                          },
                          y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(71, 85, 105, 0.3)' },
                            ticks: { color: '#cbd5e1', font: { size: 11 }, stepSize: 1 },
                          },
                        },
                      }}
                    />
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-lg font-bold text-white">
                      Historique des Points
                      {(shotTypeFilter || pointImportanceFilter) && (
                        <span className="ml-2 text-sm font-normal text-slate-400">
                          - {[shotTypeFilter, pointImportanceFilter].filter(Boolean).map((filter, i) => (
                            <span key={filter}>
                              {i > 0 && ' + '}
                              {filter === 'forehand' && 'Coup Droit'}
                              {filter === 'backhand' && 'Revers'}
                              {filter === 'serve' && 'Service'}
                              {filter === 'return' && 'Retour'}
                              {filter === 'volley' && 'Volée'}
                              {filter === 'smash' && 'Smash'}
                              {filter === 'breakPoints' && 'Break Points'}
                              {filter === 'gamePoints' && 'Game Points'}
                              {filter === 'setPoints' && 'Set Points'}
                            </span>
                          ))}
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-400">Trier par :</span>
                      <button
                        onClick={() => setSortBy('order')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          sortBy === 'order'
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        Ordre
                      </button>
                      <button
                        onClick={() => setSortBy('duration')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          sortBy === 'duration'
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        Durée
                      </button>
                    </div>
                  </div>
                  <div ref={historyContainerRef} className="p-4 max-h-[500px] overflow-y-auto">
                    <div className="space-y-3">
                      {displayedPoints.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm italic">
                          Aucun point trouvé pour ce filtre
                        </div>
                      ) : (
                        displayedPoints.map((point, index) => {
                          const originalIndex = pointsWithVideos.indexOf(point);
                          const player = point.player || (point.toggleValue?.includes('Gagne') ? 'famille' : 'adversaire');
                          const isHighlighted = highlightedPointIndex === originalIndex;

                          return (
                            <div
                              key={originalIndex}
                              ref={(el) => { pointRefs.current[index] = el; }}
                              onClick={() => {
                                if (point.videoUrl) {
                                  setPlayingPoint(point);
                                } else {
                                  setHighlightedPointIndex(originalIndex);
                                  scrollToPoint(index);
                                }
                              }}
                              className={`rounded-lg shadow-sm border p-3 flex gap-3 items-start cursor-pointer transition-all ${
                                isHighlighted
                                  ? 'bg-green-900/30 border-green-600 ring-2 ring-green-600'
                                  : 'bg-slate-900 border-slate-700 hover:border-green-600'
                              }`}
                            >
                              <div className="w-20 h-20 bg-black rounded flex items-center justify-center shrink-0 overflow-hidden relative">
                                {point.videoUrl ? (
                                  <>
                                    <video src={point.videoUrl} preload="none" className="w-full h-full object-cover" muted playsInline />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors">
                                      <Play className="text-white w-8 h-8 opacity-80 fill-white" />
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-slate-600">
                                    <Camera className="w-8 h-8" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1 gap-2">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    player === 'famille'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {player === 'famille' ? 'Point gagné' : 'Point perdu'}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    {point.videoUrl && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toggleFavorite(point.videoUrl!, point); }}
                                        className={`p-1 rounded-full transition-all ${
                                          favoriteVideos.has(point.videoUrl)
                                            ? 'text-[#C8F135]'
                                            : 'text-slate-500 hover:text-white'
                                        }`}
                                        title={favoriteVideos.has(point.videoUrl) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                      >
                                        <Star size={14} className={favoriteVideos.has(point.videoUrl) ? 'fill-current' : ''} />
                                      </button>
                                    )}
                                    {point.duration && (
                                      <span className="flex items-center gap-1 text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono border border-slate-600">
                                        <Clock className="w-2.5 h-2.5" />
                                        {point.duration}s
                                      </span>
                                    )}
                                    {point.videoUrl && (
                                      <div className="flex items-center gap-1 text-[10px] text-green-400 font-medium bg-green-950 px-1.5 py-0.5 rounded border border-green-800">
                                        <CheckCircle className="w-2.5 h-2.5" />
                                        <span>Vidéo</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-1">
                                  <p className="font-semibold text-white text-sm">
                                    Point {originalIndex + 1} - {point.toggleValue || 'Point'}
                                  </p>
                                  {point.timestamp && (
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                                      {formatTimestamp(point.timestamp)}
                                    </p>
                                  )}
                                  <p className="text-xs text-slate-300 mt-1">
                                    {point.gameScore ? (
                                      <>
                                        Score: {getTennisScore(point.gameScore.famille, point.isTiebreak || false)}-{getTennisScore(point.gameScore.adversaire, point.isTiebreak || false)}
                                        {point.setScores && ` | Games: ${point.setScores.famille.join('-')} / ${point.setScores.adversaire.join('-')}`}
                                      </>
                                    ) : point.setScores ? `Games: ${point.setScores.famille.join('-')} / ${point.setScores.adversaire.join('-')}` : 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

              </>
            );
          })()}
        </div>
      </div>

    </div>

    {playingPoint?.videoUrl && (
      <VideoPlayerModal
        videoUrl={playingPoint.videoUrl}
        onClose={() => setPlayingPoint(null)}
        title="Lecture"
        favorite={favoriteVideos.has(playingPoint.videoUrl)}
        onToggleFavorite={() => toggleFavorite(playingPoint.videoUrl!, playingPoint)}
        metadata={{
          playerName: selectedMatch?.player_name,
          shotType: playingPoint.toggleValue,
          date: selectedMatch?.date,
        }}
      />
    )}
    </>
  );
}
