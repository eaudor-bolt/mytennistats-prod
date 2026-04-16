import { useState, useEffect, useRef } from 'react';
import { X, Play, ChevronLeft, ChevronRight, Loader2, AlertCircle, ScanFace, TrendingUp, Pause, RotateCcw, Minimize2, Maximize2, Grid2x2 as Grid, List, Camera, Clock, CheckCircle, Maximize } from 'lucide-react';
import { Line, Scatter, Bar, Radar as RadarChart } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, RadialLinearScale, Filler } from 'chart.js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { InlineScoreboard } from '../components/InlineScoreboard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, RadialLinearScale, Filler);

declare global {
  interface Window {
    Pose: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
  }
}

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
};

type PointFilter = 'all' | 'breakPoints' | 'gamePoints' | 'setPoints';
type ViewMode = 'grid' | 'list';

export function MatchAnalysisPage({ onClose, inline = false }: { onClose: () => void; inline?: boolean }) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ScoringPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shotTypeFilter, setShotTypeFilter] = useState<string | null>(null);
  const [pointImportanceFilter, setPointImportanceFilter] = useState<'breakPoints' | 'gamePoints' | 'setPoints' | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [highlightedPointIndex, setHighlightedPointIndex] = useState<number | null>(null);

  // AI Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [poseError, setPoseError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [graphData, setGraphData] = useState<Array<{ time: number; leftAnkleY: number; rightAnkleY: number; leftAnkleX: number; rightAnkleX: number }>>([]);
  const [graphMode, setGraphMode] = useState<'height' | '2dPosition'>('height');
  const [isGraphCollapsed, setIsGraphCollapsed] = useState(false);
  const [graphPosition, setGraphPosition] = useState({ x: 20, y: 20 });
  const [isDraggingGraph, setIsDraggingGraph] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const historyContainerRef = useRef<HTMLDivElement>(null);
  const pointRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    loadMatches();
  }, [user]);

  // Load MediaPipe scripts
  useEffect(() => {
    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
    script1.crossOrigin = 'anonymous';
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js';
    script2.crossOrigin = 'anonymous';
    document.body.appendChild(script2);

    const script3 = document.createElement('script');
    script3.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
    script3.crossOrigin = 'anonymous';
    document.body.appendChild(script3);

    const script4 = document.createElement('script');
    script4.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
    script4.crossOrigin = 'anonymous';
    document.body.appendChild(script4);

    return () => {
      try {
        document.body.removeChild(script1);
        document.body.removeChild(script2);
        document.body.removeChild(script3);
        document.body.removeChild(script4);
      } catch (e) {
        // Scripts may have already been removed
      }
    };
  }, []);

  // Pose estimation effect
  useEffect(() => {
    let mounted = true;

    if (selectedPoint?.videoUrl && window.Pose) {
      setPoseError(false);

      try {
        const pose = new window.Pose({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        pose.onResults((results: any) => {
          if (!mounted || !canvasRef.current || !videoRef.current) return;

          const canvas = canvasRef.current;
          const video = videoRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (isAnalyzing && results.poseLandmarks) {
            if (window.drawConnectors && window.drawLandmarks && window.POSE_CONNECTIONS) {
              window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#00ff00', lineWidth: 4 });
              window.drawLandmarks(ctx, results.poseLandmarks, { color: '#ff0000', lineWidth: 2, radius: 6 });
            }

            const leftAnkle = results.poseLandmarks[27];
            const rightAnkle = results.poseLandmarks[28];

            if (leftAnkle && rightAnkle) {
              setGraphData((prev) => {
                const newData = [
                  ...prev,
                  {
                    time: video.currentTime,
                    leftAnkleY: 1 - leftAnkle.y,
                    rightAnkleY: 1 - rightAnkle.y,
                    leftAnkleX: leftAnkle.x,
                    rightAnkleX: rightAnkle.x,
                  },
                ];
                return newData.slice(-100);
              });
            }
          }
        });

        const analyzeFrame = async () => {
          if (!mounted || !videoRef.current || !isAnalyzing) return;

          try {
            await pose.send({ image: videoRef.current });
          } catch (err) {
            console.error('Pose estimation error:', err);
          }

          if (mounted && isAnalyzing) {
            requestAnimationFrame(analyzeFrame);
          }
        };

        if (isAnalyzing) {
          analyzeFrame();
        }
      } catch (err) {
        console.error('Failed to initialize pose estimation:', err);
        setPoseError(true);
      }
    }

    return () => {
      mounted = false;
    };
  }, [isAnalyzing, selectedPoint]);

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

  const getPointsWithVideos = (match: MatchResult) => {
    if (!match.scoring_history) return [];
    return match.scoring_history.filter((point) => point.videoUrl);
  };

  const isBreakPoint = (point: ScoringPoint, nextPoint?: ScoringPoint) => {
    const gameScore = point.gameScore;
    if (!gameScore || point.isTiebreak) return false;

    // Check if non-server (adversaire or famille) can win the game on next point
    // Break point for famille: adversaire is serving and famille is at 40 or ahead
    // Break point for adversaire: famille is serving and adversaire is at 40 or ahead

    // If next point exists, check who won it and if they're not the server
    if (nextPoint) {
      const pointWinner = nextPoint.player;
      const wasGameWon = nextPoint.gameScore.famille === 0 && nextPoint.gameScore.adversaire === 0;

      // Break point conversion: non-server won the game
      if (wasGameWon) {
        // Check if the winner was not serving in the previous point
        return (pointWinner === 'famille' && gameScore.famille >= 3) ||
               (pointWinner === 'adversaire' && gameScore.adversaire >= 3);
      }
    }

    // Regular break point detection: non-server is ahead
    return (gameScore.famille === 4 && gameScore.adversaire < 3) ||
           (gameScore.adversaire === 4 && gameScore.famille < 3) ||
           (gameScore.famille >= 3 && gameScore.adversaire >= 3 && Math.abs(gameScore.famille - gameScore.adversaire) === 1);
  };

  const isGamePoint = (point: ScoringPoint, nextPoint?: ScoringPoint) => {
    const gameScore = point.gameScore;
    if (!gameScore || point.isTiebreak) return false;

    // Game point: player is at 40 and ahead, or has advantage
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

    // Check if next point won the set
    if (nextPoint) {
      const nextSetScores = nextPoint.setScores;
      if (nextSetScores && nextSetScores.famille.length > setScores.famille.length) {
        // Set was won, this was a set point
        return true;
      }
    }

    // Player is one game away from winning set and is at game point
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

      // Check shot type filter
      if (shotTypeFilter) {
        const toggleValue = point.toggleValue?.toLowerCase() || '';
        const shotType = shotTypeFilter.toLowerCase();

        if (shotType === 'forehand' && !toggleValue.includes('coup droit')) return false;
        if (shotType === 'backhand' && !toggleValue.includes('revers')) return false;
        if (shotType === 'serve' && !toggleValue.includes('service')) return false;
        if (shotType === 'return' && !toggleValue.includes('retour')) return false;
        if (shotType === 'volley' && !toggleValue.includes('volée')) return false;
        if (shotType === 'smash' && !toggleValue.includes('smash')) return false;
      }

      // Check point importance filter
      if (pointImportanceFilter) {
        if (pointImportanceFilter === 'breakPoints' && !isBreakPoint(point, nextPoint)) return false;
        if (pointImportanceFilter === 'gamePoints' && !isGamePoint(point, nextPoint)) return false;
        if (pointImportanceFilter === 'setPoints' && !isSetPoint(point, nextPoint)) return false;
      }

      return true;
    });
  };

  const calculateSkillStats = (points: ScoringPoint[]) => {
    const skills = {
      forehand: { winners: 0, total: 0 },
      backhand: { winners: 0, total: 0 },
      service: { winners: 0, total: 0 },
      volley: { winners: 0, total: 0 },
      return: { winners: 0, total: 0 },
      opponent: { winners: 0, total: 0 }
    };

    points.forEach(point => {
      const toggleValue = point.toggleValue?.toLowerCase() || '';
      const isWin = point.player === 'famille' || toggleValue.includes('gagne');

      if (toggleValue.includes('coup droit')) {
        skills.forehand.total++;
        if (isWin) skills.forehand.winners++;
      } else if (toggleValue.includes('revers')) {
        skills.backhand.total++;
        if (isWin) skills.backhand.winners++;
      } else if (toggleValue.includes('service')) {
        skills.service.total++;
        if (isWin) skills.service.winners++;
      } else if (toggleValue.includes('volée')) {
        skills.volley.total++;
        if (isWin) skills.volley.winners++;
      } else if (toggleValue.includes('retour')) {
        skills.return.total++;
        if (isWin) skills.return.winners++;
      }

      if (!isWin) {
        skills.opponent.total++;
        skills.opponent.winners++;
      }
    });

    return {
      forehand: skills.forehand.total > 0 ? (skills.forehand.winners / skills.forehand.total) * 100 : 0,
      backhand: skills.backhand.total > 0 ? (skills.backhand.winners / skills.backhand.total) * 100 : 0,
      service: skills.service.total > 0 ? (skills.service.winners / skills.service.total) * 100 : 0,
      volley: skills.volley.total > 0 ? (skills.volley.winners / skills.volley.total) * 100 : 0,
      return: skills.return.total > 0 ? (skills.return.winners / skills.return.total) * 100 : 0,
      opponent: skills.opponent.total > 0 ? (skills.opponent.winners / skills.opponent.total) * 100 : 0,
    };
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const handleGraphMouseDown = (e: React.MouseEvent) => {
    if (!graphContainerRef.current) return;
    const rect = graphContainerRef.current.getBoundingClientRect();
    setIsDraggingGraph(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleGraphTouchStart = (e: React.TouchEvent) => {
    if (!graphContainerRef.current || e.touches.length !== 1) return;
    const rect = graphContainerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    setIsDraggingGraph(true);
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
  };

  const handleGraphTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingGraph || e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    setGraphPosition({
      x: touch.clientX - dragOffset.x,
      y: touch.clientY - dragOffset.y,
    });
  };

  const handleGraphTouchEnd = () => {
    setIsDraggingGraph(false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingGraph) return;
      setGraphPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDraggingGraph(false);
    };

    if (isDraggingGraph) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingGraph, dragOffset]);

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const frameStep = (direction: 'forward' | 'backward') => {
    if (!videoRef.current) return;

    const fps = 30;
    const frameDuration = 1 / fps;
    const newTime =
      direction === 'forward'
        ? Math.min(videoRef.current.currentTime + frameDuration, videoRef.current.duration)
        : Math.max(videoRef.current.currentTime - frameDuration, 0);

    videoRef.current.currentTime = newTime;

    if (!videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleFullScreen = () => {
    if (!videoContainerRef.current) return;

    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    if (!selectedPoint) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        frameStep('backward');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        frameStep('forward');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPoint]);

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

  if (!selectedPoint) {
    return (
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
                  <button
                    onClick={() => toggleShotTypeFilter('forehand')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      shotTypeFilter === 'forehand'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Coup Droit
                  </button>
                  <button
                    onClick={() => toggleShotTypeFilter('backhand')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      shotTypeFilter === 'backhand'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Revers
                  </button>
                  <button
                    onClick={() => toggleShotTypeFilter('serve')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      shotTypeFilter === 'serve'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Service
                  </button>
                  <button
                    onClick={() => toggleShotTypeFilter('return')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      shotTypeFilter === 'return'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Retour
                  </button>
                  <button
                    onClick={() => toggleShotTypeFilter('volley')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      shotTypeFilter === 'volley'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Volée
                  </button>
                  <button
                    onClick={() => toggleShotTypeFilter('smash')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      shotTypeFilter === 'smash'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Smash
                  </button>
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
                              labels: {
                                color: '#e2e8f0',
                                font: {
                                  size: 12,
                                  weight: 'bold',
                                },
                              },
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
                              grid: {
                                color: 'rgba(71, 85, 105, 0.3)',
                              },
                              ticks: {
                                color: '#cbd5e1',
                                font: {
                                  size: 11,
                                },
                              },
                            },
                            y: {
                              beginAtZero: true,
                              grid: {
                                color: 'rgba(71, 85, 105, 0.3)',
                              },
                              ticks: {
                                color: '#cbd5e1',
                                font: {
                                  size: 11,
                                },
                                stepSize: 1,
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-lg border border-slate-700">
                    <div className="px-6 py-4 border-b border-slate-700">
                      <h3 className="text-lg font-bold text-white">
                        Historique des Points
                        {(shotTypeFilter || pointImportanceFilter) && (
                          <span className="ml-2 text-sm font-normal text-slate-400">
                            - {[shotTypeFilter, pointImportanceFilter].filter(Boolean).map((filter, i, arr) => (
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
                    </div>
                    <div ref={historyContainerRef} className="p-4 max-h-[500px] overflow-y-auto">
                      <div className="space-y-3">
                        {filteredPoints.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-sm italic">
                            Aucun point trouvé pour ce filtre
                          </div>
                        ) : (
                          filteredPoints.map((point, index) => {
                            const originalIndex = pointsWithVideos.indexOf(point);
                            const player = point.player || (point.toggleValue?.includes('Gagne') ? 'famille' : 'adversaire');
                            const isHighlighted = highlightedPointIndex === originalIndex;

                            return (
                              <div
                                key={originalIndex}
                                ref={(el) => { pointRefs.current[index] = el; }}
                                onClick={(e) => {
                                  // Check if clicking on the video thumbnail
                                  const target = e.target as HTMLElement;
                                  if (target.closest('video') || target.closest('.video-overlay')) {
                                    setSelectedPoint(point);
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
                                      <video src={point.videoUrl} className="w-full h-full object-cover" muted playsInline />
                                      <div className="video-overlay absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors">
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
    );
  }

  return (
    <div className={inline ? "bg-slate-900 rounded-lg overflow-hidden" : "fixed inset-0 bg-slate-900 z-50 overflow-hidden"}>
      <div className={inline ? "flex flex-col" : "h-full flex flex-col"}>
        <div className={inline ? "bg-slate-800 px-4 py-3 flex items-center justify-between" : "bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between"}>
          <button
            onClick={() => setSelectedPoint(null)}
            className="text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Retour aux points
          </button>
          <div className="flex items-center gap-4">
            <label className={`flex items-center gap-2 cursor-pointer bg-slate-700 px-3 py-1.5 rounded-full border transition-colors select-none ${
              poseError ? 'border-red-500/50' : 'border-slate-600 hover:border-green-600'
            }`}>
              <input
                type="checkbox"
                checked={isAnalyzing}
                onChange={(e) => setIsAnalyzing(e.target.checked)}
                disabled={poseError}
                className="sr-only peer"
              />
              <ScanFace size={18} className={`transition-colors ${
                poseError ? 'text-red-400' : isAnalyzing ? 'text-green-600' : 'text-slate-400'
              }`} />
              <span className={`text-sm font-medium transition-colors ${
                poseError ? 'text-red-400' : isAnalyzing ? 'text-white' : 'text-slate-400'
              }`}>
                {poseError ? 'IA indisponible' : 'Analyse IA'}
              </span>
              {!poseError && (
                <div className={`w-8 h-4 bg-slate-600 rounded-full relative transition-colors ${isAnalyzing ? 'bg-green-600/50' : ''}`}>
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isAnalyzing ? 'translate-x-4' : ''}`}></div>
                </div>
              )}
              {poseError && (
                <AlertCircle size={16} className="text-red-400" />
              )}
            </label>
            {!inline && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-white"
              >
                <X size={24} />
              </button>
            )}
          </div>
        </div>

        <div ref={videoContainerRef} className={inline ? "bg-black flex items-center justify-center overflow-hidden relative group aspect-video" : "flex-1 bg-black flex items-center justify-center overflow-hidden relative group"}>
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={selectedPoint.videoUrl}
              crossOrigin="anonymous"
              autoPlay
              playsInline
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className="max-w-full max-h-full w-full h-auto object-contain z-10"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                frameStep('backward');
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-40 p-2 bg-slate-900/80 hover:bg-slate-800/90 backdrop-blur-sm text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110 border border-slate-700"
              title="Previous Frame (← Arrow Key)"
            >
              <ChevronLeft size={28} strokeWidth={2.5} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                frameStep('forward');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-40 p-2 bg-slate-900/80 hover:bg-slate-800/90 backdrop-blur-sm text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110 border border-slate-700"
              title="Next Frame (→ Arrow Key)"
            >
              <ChevronRight size={28} strokeWidth={2.5} />
            </button>

            {isAnalyzing && !isGraphCollapsed && (
              <div
                ref={graphContainerRef}
                className="fixed z-30 bg-slate-900/95 backdrop-blur-md border-2 border-slate-700 rounded-lg sm:rounded-xl p-2 sm:p-4 shadow-2xl touch-none"
                style={{
                  left: `${graphPosition.x}px`,
                  top: `${graphPosition.y}px`,
                  width: '50vw',
                  maxWidth: '800px',
                  cursor: isDraggingGraph ? 'grabbing' : 'grab'
                }}
                onTouchStart={handleGraphTouchStart}
                onTouchMove={handleGraphTouchMove}
                onTouchEnd={handleGraphTouchEnd}
                onMouseDown={handleGraphMouseDown}
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-sm font-bold text-slate-300 uppercase tracking-wider">
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <svg width="10" height="10" viewBox="0 0 12 12" className="text-slate-500 sm:w-3 sm:h-3">
                        <circle cx="3" cy="3" r="1.5" fill="currentColor"/>
                        <circle cx="9" cy="3" r="1.5" fill="currentColor"/>
                        <circle cx="3" cy="6" r="1.5" fill="currentColor"/>
                        <circle cx="9" cy="6" r="1.5" fill="currentColor"/>
                        <circle cx="3" cy="9" r="1.5" fill="currentColor"/>
                        <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
                      </svg>
                      <TrendingUp size={12} className="text-green-600 sm:w-4 sm:h-4" />
                    </div>
                    <span className="hidden sm:inline">Graphique</span>
                    <span className="sm:hidden">Graph</span>
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <button
                      onClick={() => setGraphMode(graphMode === 'height' ? '2dPosition' : 'height')}
                      className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] sm:text-xs font-medium transition-colors"
                      title="Switch Graph Mode"
                    >
                      {graphMode === 'height' ? 'XY' : 'H'}
                    </button>
                    <button
                      onClick={() => setIsGraphCollapsed(true)}
                      className="p-0.5 sm:p-1 text-slate-400 hover:text-white transition-colors"
                      title="Minimize"
                    >
                      <Minimize2 size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
                <div className="w-full h-32 sm:h-48 bg-slate-950/50 rounded">
                  {graphMode === 'height' ? (
                    <Line
                      data={{
                        labels: graphData.map((d) => d.time.toFixed(2)),
                        datasets: [
                          {
                            label: 'Pied gauche',
                            data: graphData.map((d) => d.leftAnkleY),
                            borderColor: '#00ff00',
                            backgroundColor: 'rgba(0, 255, 0, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0,
                            tension: 0.4,
                          },
                          {
                            label: 'Pied droit',
                            data: graphData.map((d) => d.rightAnkleY),
                            borderColor: '#ff0000',
                            backgroundColor: 'rgba(255, 0, 0, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0,
                            tension: 0.4,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { display: false },
                          y: { min: 0, max: 1, display: false },
                        },
                      }}
                    />
                  ) : (
                    <Scatter
                      data={{
                        datasets: [
                          {
                            label: 'Pied gauche',
                            data: graphData.map((d) => ({ x: d.leftAnkleX, y: d.leftAnkleY })),
                            backgroundColor: '#00ff00',
                            pointRadius: 3,
                          },
                          {
                            label: 'Pied droit',
                            data: graphData.map((d) => ({ x: d.rightAnkleX, y: d.rightAnkleY })),
                            backgroundColor: '#ff0000',
                            pointRadius: 3,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { min: 0, max: 1, display: false },
                          y: { min: 0, max: 1, display: false },
                        },
                      }}
                    />
                  )}
                </div>
                {graphMode === 'height' && (
                  <div className="flex justify-between mt-1 sm:mt-2 text-[9px] sm:text-xs text-slate-400">
                    <span>Temps (s)</span>
                    <span className="text-right">Hauteur (0.0 - 1.0)</span>
                  </div>
                )}
                {graphMode === '2dPosition' && (
                  <div className="flex justify-between mt-1 sm:mt-2 text-[9px] sm:text-xs text-slate-400">
                    <span>X Position (0.0 - 1.0)</span>
                    <span className="text-right">Y Position (0.0 - 1.0)</span>
                  </div>
                )}
              </div>
            )}

            {isAnalyzing && isGraphCollapsed && (
              <button
                onClick={() => setIsGraphCollapsed(false)}
                className="fixed z-30 bg-slate-900/95 backdrop-blur-md border-2 border-green-600 rounded-lg p-2 sm:p-3 shadow-2xl hover:bg-slate-800/95 active:bg-slate-800/95 transition-all hover:scale-105 active:scale-105"
                style={{
                  left: `${graphPosition.x}px`,
                  top: `${graphPosition.y}px`,
                }}
                title="Show Graph"
              >
                <div className="flex items-center gap-1 sm:gap-2">
                  <TrendingUp size={16} className="text-green-600 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-sm font-bold text-slate-300">XY</span>
                </div>
              </button>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
            <div className="flex flex-col gap-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-600 hover:h-2 transition-all"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                    className="text-white hover:text-green-600 transition-colors"
                  >
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                  </button>
                  <span className="text-sm font-medium text-white font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) videoRef.current.currentTime = 0;
                    }}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Restart"
                  >
                    <RotateCcw size={20} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullScreen();
                    }}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Fullscreen"
                  >
                    <Maximize size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className={inline ? "p-4 bg-slate-900 space-y-4 overflow-auto" : "p-6 bg-slate-900 space-y-4 shrink-0 border-t border-slate-800 overflow-auto max-h-[50vh]"}>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Point Details</h3>
            <div className="flex items-center gap-4 text-sm text-slate-300">
              <span className="font-medium">{selectedMatch.tournament_name}</span>
              <span>•</span>
              <span>{selectedMatch.player_name}</span>
            </div>
            {selectedPoint.toggleValue && (
              <div className="text-green-500 text-sm font-medium">
                {selectedPoint.toggleValue}
              </div>
            )}
          </div>

          <div>
            <InlineScoreboard
              setScores={selectedPoint.setScores}
              gameScore={{
                adversaire: selectedPoint.gameScore ? String(selectedPoint.gameScore.adversaire) : '0',
                famille: selectedPoint.gameScore ? String(selectedPoint.gameScore.famille) : '0'
              }}
              playerName={selectedMatch.player_name}
              size="normal"
            />
          </div>

          {(shotTypeFilter || pointImportanceFilter) && filteredPoints.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">
                Points Filtrés: {[shotTypeFilter, pointImportanceFilter].filter(Boolean).map((filter, i, arr) => (
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
              </h3>

              {/* Radar Chart for Filtered Points */}
              {pointImportanceFilter && filteredPoints.length > 0 && (() => {
                const skillStats = calculateSkillStats(filteredPoints);
                return (
                  <div className="flex justify-center items-center py-4">
                    <div className="w-32 h-32">
                      <RadarChart
                        data={{
                          labels: ['Forehand', 'Backhand', 'Service', 'Volley', 'Return', 'Opponent'],
                          datasets: [
                            {
                              label: 'Win %',
                              data: [
                                skillStats.forehand,
                                skillStats.backhand,
                                skillStats.service,
                                skillStats.volley,
                                skillStats.return,
                                skillStats.opponent,
                              ],
                              backgroundColor: 'rgba(34, 197, 94, 0.2)',
                              borderColor: 'rgba(34, 197, 94, 1)',
                              borderWidth: 2,
                              pointBackgroundColor: 'rgba(34, 197, 94, 1)',
                              pointBorderColor: '#fff',
                              pointHoverBackgroundColor: '#fff',
                              pointHoverBorderColor: 'rgba(34, 197, 94, 1)',
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: true,
                          scales: {
                            r: {
                              beginAtZero: true,
                              max: 100,
                              ticks: {
                                stepSize: 25,
                                color: '#94a3b8',
                                font: { size: 8 },
                                backdropColor: 'transparent',
                              },
                              grid: {
                                color: 'rgba(148, 163, 184, 0.3)',
                              },
                              angleLines: {
                                color: 'rgba(148, 163, 184, 0.3)',
                              },
                              pointLabels: {
                                color: '#cbd5e1',
                                font: { size: 9, weight: 'bold' },
                              },
                            },
                          },
                          plugins: {
                            legend: {
                              display: false,
                            },
                            tooltip: {
                              backgroundColor: 'rgba(15, 23, 42, 0.95)',
                              titleColor: '#e2e8f0',
                              bodyColor: '#e2e8f0',
                              borderColor: '#475569',
                              borderWidth: 1,
                              callbacks: {
                                label: (context) => {
                                  return `${context.label}: ${context.parsed.r.toFixed(1)}%`;
                                },
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3">
                {filteredPoints.map((point, index) => {
                  const originalIndex = pointsWithVideos.indexOf(point);
                  const player = point.player || (point.toggleValue?.includes('Gagne') ? 'famille' : 'adversaire');
                  const isCurrentPoint = point === selectedPoint;

                  return (
                    <div
                      key={originalIndex}
                      onClick={() => {
                        if (!isCurrentPoint) {
                          setSelectedPoint(point);
                          setIsPlaying(false);
                        }
                      }}
                      className={`rounded-lg shadow-sm border p-3 flex gap-3 items-start transition-all ${
                        isCurrentPoint
                          ? 'bg-green-900/30 border-green-600 cursor-default'
                          : 'bg-slate-800 border-slate-700 hover:border-green-600 cursor-pointer'
                      }`}
                    >
                      <div className="w-20 h-20 bg-black rounded flex items-center justify-center shrink-0 overflow-hidden relative">
                        {point.videoUrl ? (
                          <>
                            <video src={point.videoUrl} className="w-full h-full object-cover" muted playsInline />
                            {!isCurrentPoint && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors">
                                <Play className="text-white w-8 h-8 opacity-80 fill-white" />
                              </div>
                            )}
                            {isCurrentPoint && (
                              <div className="absolute inset-0 flex items-center justify-center bg-green-600/20 border-2 border-green-500">
                                <div className="text-green-500 text-xs font-bold bg-slate-900/80 px-2 py-1 rounded">
                                  En cours
                                </div>
                              </div>
                            )}
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
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
