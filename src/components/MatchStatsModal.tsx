import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { X, TrendingUp, BarChart2, Radar, Medal, Zap, Video, Play, Clock, ChevronLeft, ChevronRight, Camera, Target, Crosshair } from 'lucide-react';
import { MatchResult } from '../lib/supabase';
import { FinalScoreboard } from './FinalScoreboard';
import { InlineScoreboard } from './InlineScoreboard';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Radar as RadarChart, Bar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

type MatchStatsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  match: MatchResult | null;
};

export function MatchStatsModal({ isOpen, onClose, match }: MatchStatsModalProps) {
  const [selectedGraphType, setSelectedGraphType] = useState<'winners-errors' | 'duration'>('winners-errors');
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedShotFilter, setSelectedShotFilter] = useState<string | null>(null);
  const [selectedPointImportance, setSelectedPointImportance] = useState<'breakPoints' | 'gamePoints' | 'setPoints' | null>(null);
  const [highlightedBarIndex, setHighlightedBarIndex] = useState<number | null>(null);
  const [skillDataType, setSkillDataType] = useState<'win' | 'loss'>('win');
  const [videoModalOpen, setVideoModalOpen] = useState<boolean>(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');

  // Touch handling for swipe gestures
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const historyContainerRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;

      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollBarWidth}px`;

      // Prevent background scrolling on touch devices
      const preventBackgroundScroll = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        const modalContent = target.closest('[data-modal-content]');

        // Allow scrolling within the modal content
        if (modalContent) {
          return;
        }

        // Prevent scrolling on the overlay/background
        e.preventDefault();
      };

      document.addEventListener('touchmove', preventBackgroundScroll, { passive: false });

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
        document.removeEventListener('touchmove', preventBackgroundScroll);
      };
    }
  }, [isOpen]);

  const toggleSkill = (skill: string) => {
    setSelectedShotFilter(prev => prev === skill ? null : skill);
  };

  const togglePointImportance = (type: 'breakPoints' | 'gamePoints' | 'setPoints') => {
    setSelectedPointImportance(prev => prev === type ? null : type);
  };

  const scrollToBar = (index: number) => {
    const barElement = barRefs.current.get(index);
    if (barElement && graphContainerRef.current) {
      const container = graphContainerRef.current;
      const barRect = barElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const offset = barRect.left - containerRect.left - (containerRect.width / 2) + (barRect.width / 2);

      container.scrollTo({
        left: container.scrollLeft + offset,
        behavior: 'smooth'
      });
    }
  };

  const shouldExcludePoint = (currentIndex: number, scoringHistory: any[]): boolean => {
    if (currentIndex === 0) return true;

    const currentPoint = scoringHistory[currentIndex];
    const prevPoint = scoringHistory[currentIndex - 1];

    if (!currentPoint?.gameScore || !prevPoint?.gameScore) return false;

    const currentGameScore = currentPoint.gameScore;
    const prevGameScore = prevPoint.gameScore;

    const currentAdv = typeof currentGameScore.adversaire === 'number' ? currentGameScore.adversaire : 0;
    const currentFam = typeof currentGameScore.famille === 'number' ? currentGameScore.famille : 0;
    const prevAdv = typeof prevGameScore.adversaire === 'number' ? prevGameScore.adversaire : 0;
    const prevFam = typeof prevGameScore.famille === 'number' ? prevGameScore.famille : 0;

    // Exclude the first point of a new game (when game score resets to 0-0)
    if (currentAdv === 0 && currentFam === 0 && (prevAdv > 0 || prevFam > 0)) {
      return true;
    }

    // Check for set change (first point of new set after completing previous set)
    if (currentPoint.setScores && prevPoint.setScores) {
      for (let setIndex = 0; setIndex < 3; setIndex++) {
        const currentSetGames = (currentPoint.setScores.adversaire[setIndex] || 0) + (currentPoint.setScores.famille[setIndex] || 0);
        const prevSetGames = (prevPoint.setScores.adversaire[setIndex] || 0) + (prevPoint.setScores.famille[setIndex] || 0);

        // New set started
        if (setIndex > 0 && currentSetGames === 0 && prevSetGames > 0) {
          return true;
        }
      }
    }

    return false;
  };

  const convertScoreToTennisFormat = (score: number | string): string => {
    if (typeof score === 'string') return score;
    const scoreMap: Record<number, string> = { 0: '0', 1: '15', 2: '30', 3: '40' };
    return scoreMap[score] || String(score);
  };

  const isGamePoint = (entry: any): boolean => {
    if (!entry?.gameScore) return false;
    const adversaire = convertScoreToTennisFormat(entry.gameScore.adversaire);
    const famille = convertScoreToTennisFormat(entry.gameScore.famille);

    // Game point scenarios:
    // 40-30, 40-15, 40-0 (for adversaire)
    // 30-40, 15-40, 0-40 (for famille)
    // AD-40, 40-AD (advantage situations)
    // 40-40 when no_ad is true (next point wins)

    if (adversaire === 'AD' || famille === 'AD') {
      return true;
    }

    // If no_ad is true, 40-40 is a game point (no advantage, next point wins)
    if (match?.no_ad && adversaire === '40' && famille === '40') {
      return true;
    }

    if (adversaire === '40' && famille !== '40' && famille !== 'AD') {
      return true;
    }

    if (famille === '40' && adversaire !== '40' && adversaire !== 'AD') {
      return true;
    }

    return false;
  };

  const isSetPoint = (entry: any): boolean => {
    if (!entry?.setScores || !isGamePoint(entry)) return false;
    const { adversaire, famille } = entry.setScores;
    const gameScore = entry.gameScore || { adversaire: 0, famille: 0 };

    // Check if in tiebreak (game scores are high numbers like 7-6)
    const isTiebreak = gameScore.adversaire >= 6 || gameScore.famille >= 6;

    // Get the game_per_set configuration (default to 6 if not set)
    const gamesPerSet = match?.game_per_set || 6;

    for (let i = 0; i < 3; i++) {
      const advGames = adversaire[i] || 0;
      const famGames = famille[i] || 0;

      // During tiebreak at 6-6
      if (isTiebreak && advGames === 6 && famGames === 6) {
        return true;
      }

      // Set point scenarios based on game_per_set configuration
      if (gamesPerSet === 6) {
        // 6 games format: 5-x (x<5), 6-5
        if ((advGames === 5 && famGames < 5) ||
            (famGames === 5 && advGames < 5) ||
            (advGames === 6 && famGames === 5) ||
            (famGames === 6 && advGames === 5)) {
          return true;
        }
      } else if (gamesPerSet === 4) {
        // 4 games format: 3-x (x<3), 4-3
        if ((advGames === 3 && famGames < 3) ||
            (famGames === 3 && advGames < 3) ||
            (advGames === 4 && famGames === 3) ||
            (famGames === 4 && advGames === 3)) {
          return true;
        }
      } else if (gamesPerSet === 3) {
        // 3 games format: 2-x (x<2), 3-2
        if ((advGames === 2 && famGames < 2) ||
            (famGames === 2 && advGames < 2) ||
            (advGames === 3 && famGames === 2) ||
            (famGames === 3 && advGames === 2)) {
          return true;
        }
      }
    }
    return false;
  };

  const isMatchPoint = (entry: any): boolean => {
    if (!entry?.setScores || !isSetPoint(entry)) return false;
    const { adversaire, famille } = entry.setScores;

    let advSets = 0;
    let famSets = 0;

    for (let i = 0; i < 3; i++) {
      if ((adversaire[i] || 0) > (famille[i] || 0)) advSets++;
      if ((famille[i] || 0) > (adversaire[i] || 0)) famSets++;
    }

    return advSets === 1 || famSets === 1;
  };

  const calculateMatchStats = (scoringHistory: any[]) => {
    if (!scoringHistory || scoringHistory.length === 0) {
      return {
        aces: 0,
        doubleFaults: 0,
        avgDurationPoints: 0,
        maxDurationPoint: 0,
        totalWinners: 0,
        totalFaults: 0,
        totalPoints: 0,
        forehandWinners: 0,
        forehandFaults: 0,
        backhandWinners: 0,
        backhandFaults: 0,
        volleyWinners: 0,
        volleyFaults: 0,
        serviceWinners: 0,
        serviceFaults: 0,
        returnWinners: 0,
        returnFaults: 0,
        opponentWinners: 0,
        opponentFaults: 0,
        skillStats: {},
        breakPointsTotal: 0,
        breakPointsConverted: 0,
        breakPointsDefendedTotal: 0,
        breakPointsDefendedConverted: 0,
        gamePointsTotal: 0,
        gamePointsConverted: 0,
        adversaireGamePointsTotal: 0,
        adversaireGamePointsConverted: 0,
        setPointsTotal: 0,
        setPointsConverted: 0,
        adversaireSetPointsTotal: 0,
        adversaireSetPointsConverted: 0,
      };
    }

    let aces = 0;
    let doubleFaults = 0;
    let totalWinners = 0;
    let totalFaults = 0;
    let totalDuration = 0;
    let maxDuration = 0;
    let pointCount = 0;

    const skillCounts: Record<string, { winners: number; faults: number }> = {
      forehand: { winners: 0, faults: 0 },
      backhand: { winners: 0, faults: 0 },
      volley: { winners: 0, faults: 0 },
      service: { winners: 0, faults: 0 },
      return: { winners: 0, faults: 0 },
      opponent: { winners: 0, faults: 0 },
    };

    scoringHistory.forEach((entry, index) => {
      if (entry.toggleValue) {
        const [skill, action] = entry.toggleValue.split(': ');

        if (action === 'Gagne') {
          if (skill !== 'opponent') totalWinners++;
          if (skillCounts[skill]) skillCounts[skill].winners++;
          if (skill === 'service') aces++;
        } else if (action === 'Faute') {
          if (skill !== 'opponent') totalFaults++;
          if (skillCounts[skill]) skillCounts[skill].faults++;
          if (skill === 'service') doubleFaults++;
        }
      }

      if (index > 0 && !shouldExcludePoint(index, scoringHistory)) {
        const prevEntry = scoringHistory[index - 1];
        let duration = 0;

        if (entry.timestampMs && prevEntry.timestampMs) {
          duration = (entry.timestampMs - prevEntry.timestampMs) / 1000;
        } else if (entry.timestamp && prevEntry.timestamp) {
          const prevTime = new Date(prevEntry.timestamp).getTime();
          const currentTime = new Date(entry.timestamp).getTime();
          duration = (currentTime - prevTime) / 1000;
        } else if (entry.datetime && prevEntry.datetime) {
          const prevTime = new Date(prevEntry.datetime).getTime();
          const currentTime = new Date(entry.datetime).getTime();
          duration = (currentTime - prevTime) / 1000;
        }

        if (duration > 0 && duration < 300) {
          totalDuration += duration;
          maxDuration = Math.max(maxDuration, duration);
          pointCount++;
        }
      }
    });

    const skillStats: any = {};
    const skills = ['forehand', 'backhand', 'service', 'volley', 'return', 'opponent'];

    skills.forEach(skill => {
      const skillEntries = scoringHistory.filter(entry => {
        if (entry.toggleValue) {
          const [entrySkill] = entry.toggleValue.split(': ');
          return entrySkill === skill;
        }
        return false;
      });

      const skillWinners = skillEntries.filter(entry => {
        const [, action] = entry.toggleValue.split(': ');
        return action === 'Gagne';
      }).length;

      const skillFaults = skillEntries.filter(entry => {
        const [, action] = entry.toggleValue.split(': ');
        return action === 'Faute';
      }).length;

      const skillTotal = skillEntries.length;
      const skillPercentage = skillTotal > 0 ? Math.round((skillWinners / skillTotal) * 100) : 0;
      const faultPercentage = skillTotal > 0 ? Math.round((skillFaults / skillTotal) * 100) : 0;

      skillStats[skill] = {
        winners: skillWinners,
        faults: skillFaults,
        total: skillTotal,
        percentage: skillPercentage,
        faultPercentage: faultPercentage,
      };
    });

    // Calculate break points and game points using flags from scoring history
    let breakPointsTotal = 0;
    let breakPointsConverted = 0;
    let breakPointsDefendedTotal = 0;
    let breakPointsDefendedConverted = 0;
    let gamePointsTotal = 0;
    let gamePointsConverted = 0;
    let adversaireGamePointsTotal = 0;
    let adversaireGamePointsConverted = 0;
    let setPointsTotal = 0;
    let setPointsConverted = 0;
    let adversaireSetPointsTotal = 0;
    let adversaireSetPointsConverted = 0;

    scoringHistory.forEach((entry, index) => {
      const currentGamePoint = entry.isGamePoint || false;
      const currentBreakPoint = entry.isBreakPoint || false;
      const server = entry.server || entry.player || 'famille';
      const pointWinner = entry.player || 'famille';

      // Determine who won the point
      let skill = 'unknown';
      let action = 'unknown';
      if (entry.toggleValue) {
        if (entry.toggleValue === 'Score direct') {
          skill = 'direct';
          action = 'Gagne';
        } else {
          [skill, action] = entry.toggleValue.split(': ');
        }
      }

      // Point won by famille if action is "Gagne" and skill is not "opponent"
      // Point won by adversaire if skill is "opponent" with "Gagne" OR if skill is not "opponent" with "Faute"
      const familleWonPoint = (action === 'Gagne' && skill !== 'opponent') || (action === 'Faute' && skill === 'opponent');
      const adversaireWonPoint = !familleWonPoint;

      // Determine who has the game point
      const gameScore = entry.gameScore || { adversaire: 0, famille: 0 };
      const adversaireScore = convertScoreToTennisFormat(gameScore.adversaire);
      const familleScore = convertScoreToTennisFormat(gameScore.famille);
      const isNoAdDeuce = match?.no_ad && adversaireScore === '40' && familleScore === '40';

      const familleHasGamePoint = familleScore === 'AD' ||
                                   (familleScore === '40' && adversaireScore !== '40' && adversaireScore !== 'AD') ||
                                   isNoAdDeuce;
      const adversaireHasGamePoint = adversaireScore === 'AD' ||
                                      (adversaireScore === '40' && familleScore !== '40' && familleScore !== 'AD') ||
                                      isNoAdDeuce;

      // Break points for Joueur (famille) - when adversaire is serving
      if (currentBreakPoint && server === 'adversaire') {
        breakPointsTotal++;
        if (familleWonPoint) {
          breakPointsConverted++;
        }
      }

      // Break points for Adversaire - when famille is serving
      if (currentBreakPoint && server === 'famille') {
        breakPointsDefendedTotal++;
        if (adversaireWonPoint) {
          breakPointsDefendedConverted++;
        }
      }

      // Game points for Joueur (famille)
      if (currentGamePoint && familleHasGamePoint) {
        gamePointsTotal++;
        if (familleWonPoint) {
          gamePointsConverted++;
        }
      }

      // Game points for Adversaire
      if (currentGamePoint && adversaireHasGamePoint) {
        adversaireGamePointsTotal++;
        if (adversaireWonPoint) {
          adversaireGamePointsConverted++;
        }
      }

      // Set points for famille
      const currentSetPoint = entry.isSetPoint || false;
      if (currentSetPoint && familleHasGamePoint) {
        setPointsTotal++;
        if (familleWonPoint) {
          setPointsConverted++;
        }
      }

      // Set points for adversaire
      if (currentSetPoint && adversaireHasGamePoint) {
        adversaireSetPointsTotal++;
        if (adversaireWonPoint) {
          adversaireSetPointsConverted++;
        }
      }
    });

    return {
      aces,
      doubleFaults,
      avgDurationPoints: pointCount > 0 ? Math.round(totalDuration / pointCount) : 0,
      maxDurationPoint: Math.round(maxDuration),
      totalWinners,
      totalFaults,
      totalPoints: scoringHistory.length,
      forehandWinners: skillCounts.forehand.winners,
      forehandFaults: skillCounts.forehand.faults,
      backhandWinners: skillCounts.backhand.winners,
      backhandFaults: skillCounts.backhand.faults,
      volleyWinners: skillCounts.volley.winners,
      volleyFaults: skillCounts.volley.faults,
      serviceWinners: skillCounts.service.winners,
      serviceFaults: skillCounts.service.faults,
      returnWinners: skillCounts.return.winners,
      returnFaults: skillCounts.return.faults,
      opponentWinners: skillCounts.opponent.winners,
      opponentFaults: skillCounts.opponent.faults,
      skillStats,
      breakPointsTotal,
      breakPointsConverted,
      breakPointsDefendedTotal,
      breakPointsDefendedConverted,
      gamePointsTotal,
      gamePointsConverted,
      adversaireGamePointsTotal,
      adversaireGamePointsConverted,
      setPointsTotal,
      setPointsConverted,
      adversaireSetPointsTotal,
      adversaireSetPointsConverted,
    };
  };

  const processChartData = (scoringHistory: any[]) => {
    if (!scoringHistory || scoringHistory.length === 0) return [];

    let currentGamePointCount = 0;
    let currentBreakPointCount = 0;
    let lastGameScoreStr = '';

    return scoringHistory.map((entry, index) => {
      let skill = 'unknown';
      let action = 'unknown';
      let duration = 0;

      if (entry.toggleValue) {
        // Handle 'Score direct' case (manual scoring without skill selection)
        if (entry.toggleValue === 'Score direct') {
          skill = 'direct';
          action = 'Gagne';
        } else {
          [skill, action] = entry.toggleValue.split(': ');
        }
      }

      if (index > 0 && !shouldExcludePoint(index, scoringHistory)) {
        const prevEntry = scoringHistory[index - 1];

        if (entry.timestampMs && prevEntry.timestampMs) {
          duration = (entry.timestampMs - prevEntry.timestampMs) / 1000;
        } else if (entry.timestamp && prevEntry.timestamp) {
          const prevTime = new Date(prevEntry.timestamp).getTime();
          const currentTime = new Date(entry.timestamp).getTime();
          duration = (currentTime - prevTime) / 1000;
        } else if (entry.datetime && prevEntry.datetime) {
          const prevTime = new Date(prevEntry.datetime).getTime();
          const currentTime = new Date(entry.datetime).getTime();
          duration = (currentTime - prevTime) / 1000;
        }

        if (duration > 300) duration = 0;
      }

      // Convert numeric game scores to tennis format for display
      const gameScore = entry.gameScore || { adversaire: 0, famille: 0 };
      const displayGameScore = {
        adversaire: convertScoreToTennisFormat(gameScore.adversaire),
        famille: convertScoreToTennisFormat(gameScore.famille),
      };

      const player = entry.player || (skill === 'opponent' ? 'adversaire' : 'famille');
      const server = entry.server || entry.player || 'famille';

      // Track game point and break point numbers in sequence
      const currentGameScoreStr = `${displayGameScore.adversaire}-${displayGameScore.famille}`;
      const isGamePoint = entry.isGamePoint || false;
      const isBreakPoint = entry.isBreakPoint || false;

      // Reset counters when game score changes to 0-0 (new game)
      if (currentGameScoreStr === '0-0' && lastGameScoreStr !== '0-0') {
        currentGamePointCount = 0;
        currentBreakPointCount = 0;
      }

      // Determine who has the game point
      const adversaireScore = displayGameScore.adversaire;
      const familleScore = displayGameScore.famille;
      const isNoAdDeuce = match?.no_ad && adversaireScore === '40' && familleScore === '40';

      const familleHasGamePoint = familleScore === 'AD' ||
                                   (familleScore === '40' && adversaireScore !== '40' && adversaireScore !== 'AD') ||
                                   isNoAdDeuce;
      const adversaireHasGamePoint = adversaireScore === 'AD' ||
                                      (adversaireScore === '40' && familleScore !== '40' && familleScore !== 'AD') ||
                                      isNoAdDeuce;

      let gamePointNumber = 0;
      let gamePointPlayer = '';
      if (isGamePoint) {
        currentGamePointCount++;
        gamePointNumber = currentGamePointCount;

        // Determine which player has the game point
        if (familleHasGamePoint && adversaireHasGamePoint) {
          // Both have game point (no-ad deuce)
          gamePointPlayer = 'both';
        } else if (familleHasGamePoint) {
          gamePointPlayer = 'famille';
        } else if (adversaireHasGamePoint) {
          gamePointPlayer = 'adversaire';
        }
      }

      let breakPointNumber = 0;
      let breakPointPlayer = '';
      if (isBreakPoint) {
        currentBreakPointCount++;
        breakPointNumber = currentBreakPointCount;

        // Break point is always for the receiver (non-server)
        breakPointPlayer = server === 'famille' ? 'adversaire' : 'famille';
      }

      // Determine who has the set point
      let setPointPlayer = '';
      if (entry.isSetPoint && isGamePoint) {
        // Set point follows the same logic as game point
        if (familleHasGamePoint && adversaireHasGamePoint) {
          setPointPlayer = 'both';
        } else if (familleHasGamePoint) {
          setPointPlayer = 'famille';
        } else if (adversaireHasGamePoint) {
          setPointPlayer = 'adversaire';
        }
      }

      lastGameScoreStr = currentGameScoreStr;

      // Use the stored values from the JSON instead of recalculating
      return {
        index: index + 1,
        skill,
        action,
        duration,
        isWinner: action === 'Gagne',
        isFault: action === 'Faute',
        player,
        setScores: entry.setScores || { adversaire: [0, 0, 0], famille: [0, 0, 0] },
        gameScore: displayGameScore,
        isGamePoint,
        gamePointNumber,
        gamePointPlayer,
        isSetPoint: entry.isSetPoint || false,
        setPointPlayer,
        isMatchPoint: entry.isMatchPoint || false,
        isBreakPoint,
        breakPointNumber,
        breakPointPlayer,
        server,
        videoUrl: entry.videoUrl || null,
      };
    });
  };

  const getSkillColor = (skill: string) => {
    const colors: Record<string, string> = {
      forehand: '#10b981',
      backhand: '#3b82f6',
      volley: '#8b5cf6',
      service: '#f59e0b',
      return: '#06b6d4',
      opponent: '#6b7280',
      direct: '#000000',
    };
    return colors[skill] || '#6b7280';
  };

  const stats = useMemo(() => calculateMatchStats(match?.scoring_history || []), [match]);
  const chartData = useMemo(() => processChartData(match?.scoring_history || []), [match]);

  // Filtered chart data for history log
  const historyFilteredData = useMemo(() => {
    return chartData.filter((point) => {
      // Filter by shot type
      if (selectedShotFilter) {
        if (point.skill !== selectedShotFilter && point.skill !== 'direct' && point.skill !== 'unknown') {
          return false;
        }
      }

      // Filter by point importance using AND logic
      if (selectedPointImportance) {
        if (selectedPointImportance === 'breakPoints' && !point.isBreakPoint) return false;
        if (selectedPointImportance === 'gamePoints' && !point.isGamePoint) return false;
        if (selectedPointImportance === 'setPoints' && !point.isSetPoint) return false;
      }

      return true;
    });
  }, [chartData, selectedShotFilter, selectedPointImportance]);

  // Calculate skill stats for filtered points
  const calculateFilteredSkillStats = (points: typeof chartData) => {
    const skills = {
      forehand: { winners: 0, losses: 0, total: 0 },
      backhand: { winners: 0, losses: 0, total: 0 },
      service: { winners: 0, losses: 0, total: 0 },
      volley: { winners: 0, losses: 0, total: 0 },
      return: { winners: 0, losses: 0, total: 0 },
      opponent: { winners: 0, losses: 0, total: 0 }
    };

    points.forEach(point => {
      const skill = point.skill;
      const isWin = point.isWinner;

      if (skill === 'forehand') {
        skills.forehand.total++;
        if (isWin) skills.forehand.winners++;
        else skills.forehand.losses++;
      } else if (skill === 'backhand') {
        skills.backhand.total++;
        if (isWin) skills.backhand.winners++;
        else skills.backhand.losses++;
      } else if (skill === 'service') {
        skills.service.total++;
        if (isWin) skills.service.winners++;
        else skills.service.losses++;
      } else if (skill === 'volley') {
        skills.volley.total++;
        if (isWin) skills.volley.winners++;
        else skills.volley.losses++;
      } else if (skill === 'return') {
        skills.return.total++;
        if (isWin) skills.return.winners++;
        else skills.return.losses++;
      } else if (skill === 'opponent') {
        skills.opponent.total++;
        if (isWin) skills.opponent.winners++;
        else skills.opponent.losses++;
      }
    });

    return {
      wins: {
        forehand: skills.forehand.total > 0 ? (skills.forehand.winners / skills.forehand.total) * 100 : 0,
        backhand: skills.backhand.total > 0 ? (skills.backhand.winners / skills.backhand.total) * 100 : 0,
        service: skills.service.total > 0 ? (skills.service.winners / skills.service.total) * 100 : 0,
        volley: skills.volley.total > 0 ? (skills.volley.winners / skills.volley.total) * 100 : 0,
        return: skills.return.total > 0 ? (skills.return.winners / skills.return.total) * 100 : 0,
        opponent: skills.opponent.total > 0 ? (skills.opponent.winners / skills.opponent.total) * 100 : 0,
      },
      losses: {
        forehand: skills.forehand.total > 0 ? (skills.forehand.losses / skills.forehand.total) * 100 : 0,
        backhand: skills.backhand.total > 0 ? (skills.backhand.losses / skills.backhand.total) * 100 : 0,
        service: skills.service.total > 0 ? (skills.service.losses / skills.service.total) * 100 : 0,
        volley: skills.volley.total > 0 ? (skills.volley.losses / skills.volley.total) * 100 : 0,
        return: skills.return.total > 0 ? (skills.return.losses / skills.return.total) * 100 : 0,
        opponent: skills.opponent.total > 0 ? (skills.opponent.losses / skills.opponent.total) * 100 : 0,
      }
    };
  };

  // Filtered chart data based on filter settings (for duration graph only)
  const filteredChartData = useMemo(() => {
    if (selectedGraphType !== 'duration') return chartData;

    return chartData.filter((point) => {
      // Filter by shot type
      if (selectedShotFilter) {
        if (point.skill !== selectedShotFilter && point.skill !== 'direct' && point.skill !== 'unknown') {
          return false;
        }
      }

      // Filter by point importance using AND logic
      if (selectedPointImportance) {
        if (selectedPointImportance === 'breakPoints' && !point.isBreakPoint) return false;
        if (selectedPointImportance === 'gamePoints' && !point.isGamePoint) return false;
        if (selectedPointImportance === 'setPoints' && !point.isSetPoint) return false;
      }

      return true;
    });
  }, [chartData, selectedGraphType, selectedShotFilter, selectedPointImportance]);

  const minDuration = useMemo(() => {
    const durations = chartData.filter(p => p.duration > 0).map(p => p.duration);
    return durations.length > 0 ? Math.min(...durations) : 1;
  }, [chartData]);

  const maxDuration = useMemo(() => {
    const durations = chartData.filter(p => p.duration > 0).map(p => p.duration);
    return durations.length > 0 ? Math.max(...durations) : 1;
  }, [chartData]);

  // Navigate to next/previous point
  const navigatePoint = useCallback((direction: 'next' | 'prev') => {
    if (selectedPoint === null || chartData.length === 0) return;

    // Use the appropriate dataset based on the current graph type
    const dataToUse = selectedGraphType === 'duration' ? filteredChartData : chartData;

    // Find the current point
    const currentPoint = dataToUse.find(p => p.index === selectedPoint);
    if (!currentPoint) return;

    // Sort data by index to ensure correct order
    const sortedData = [...dataToUse].sort((a, b) => a.index - b.index);
    const currentSortedIndex = sortedData.findIndex(p => p.index === selectedPoint);
    if (currentSortedIndex === -1) return;

    // Navigate to previous (lower index) or next (higher index) point
    let newSortedIndex = direction === 'prev' ? currentSortedIndex - 1 : currentSortedIndex + 1;

    // Wrap around
    if (newSortedIndex < 0) newSortedIndex = sortedData.length - 1;
    if (newSortedIndex >= sortedData.length) newSortedIndex = 0;

    const newPoint = sortedData[newSortedIndex];
    setSelectedPoint(newPoint.index);

    // Update click position based on the new bar location
    if (selectedGraphType === 'winners-errors' && graphContainerRef.current) {
      // Find the bar in the original chartData order (how it's displayed)
      const displayIndex = chartData.findIndex(p => p.index === newPoint.index);
      const bars = graphContainerRef.current.querySelectorAll('.bar-clickable');
      const targetBar = bars[displayIndex] as HTMLElement;
      if (targetBar) {
        const rect = targetBar.getBoundingClientRect();
        const scrollContainer = targetBar.closest('.overflow-x-auto') as HTMLElement;
        if (scrollContainer) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const relativeX = rect.right - containerRect.left + scrollContainer.scrollLeft + 5;
          const relativeY = rect.top + rect.height / 2 - containerRect.top + scrollContainer.scrollTop;
          setClickPosition({ x: relativeX, y: relativeY });
        }
      }
    } else if (selectedGraphType === 'duration') {
      // For duration chart, keep the popup at a relative center position
      // The Chart.js bar positions are dynamic, so we'll keep a simple centered position
      // Position is maintained by the chart click handler
    }
  }, [selectedPoint, chartData, filteredChartData, selectedGraphType]);

  // Handle keyboard navigation
  useEffect(() => {
    if (selectedPoint === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePoint('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigatePoint('next');
      } else if (e.key === 'Escape') {
        setSelectedPoint(null);
        setClickPosition(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPoint, navigatePoint]);

  // Handle touch swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    if (selectedPoint === null) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (selectedPoint === null) return;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (selectedPoint === null) return;

    const swipeThreshold = 50;
    const swipeDistance = touchStartX.current - touchEndX.current;

    if (Math.abs(swipeDistance) > swipeThreshold) {
      if (swipeDistance > 0) {
        // Swiped left - go to next point
        navigatePoint('next');
      } else {
        // Swiped right - go to previous point
        navigatePoint('prev');
      }
    }

    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  if (!isOpen || !match) return null;

  const totalWinnersFaultsCount = stats.totalWinners + stats.totalFaults;
  const winnersPercentage = totalWinnersFaultsCount > 0
    ? Math.round((stats.totalWinners / totalWinnersFaultsCount) * 100)
    : 0;
  const faultsPercentage = totalWinnersFaultsCount > 0
    ? Math.round((stats.totalFaults / totalWinnersFaultsCount) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 50 }}
      onClick={onClose}
    >
      <div
        data-modal-content
        className="bg-gradient-to-br from-[#050d1a] via-[#071428] to-[#050d1a] rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-white/10"
        style={{ position: 'relative', zIndex: 51 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-br from-[#050d1a] via-[#071428] to-[#050d1a] border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-xl font-bold text-white">Statistiques du Match</h3>
            <p className="text-sm text-gray-400 mt-1">
              {match.player_name} - {match.tournament_name} ({new Date(match.date).toLocaleDateString('fr-FR')})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Match Score Overview */}
          {match.score && (
            <FinalScoreboard
              score={match.score}
              playerName={match.player_name}
              isWin={(() => {
                const sets = match.score.split(' - ');
                let playerSets = 0;
                let opponentSets = 0;
                sets.forEach(set => {
                  // Handle super tiebreak format (10/5)
                  const superTiebreakMatch = set.match(/^\((\d+)\/(\d+)\)$/);
                  if (superTiebreakMatch) {
                    const [, player, opponent] = superTiebreakMatch;
                    if (parseInt(player) > parseInt(opponent)) playerSets++;
                    else opponentSets++;
                    return;
                  }
                  // Regular set format
                  const cleanSet = set.replace(/\s*\(.*?\)\s*/g, '');
                  const [player, opponent] = cleanSet.split('/').map(Number);
                  if (player > opponent) playerSets++;
                  else if (opponent > player) opponentSets++;
                });
                return playerSets > opponentSets;
              })()}
              showWinnerIcon={true}
            />
          )}

          {/* Resume Stats Title */}
          <h4 className="text-lg font-bold text-white">Resume stats - {match.player_name}</h4>

          {/* Primary Stats - Modern Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`bg-white/5 rounded-xl shadow-md border-l-4 ${winnersPercentage >= 50 ? 'border-green-500' : 'border-red-500'} p-4 hover:bg-white/10 transition-all`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Winners</div>
                <Zap className={`w-5 h-5 ${winnersPercentage >= 50 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <div className="text-3xl font-bold text-white">{stats.totalWinners}</div>
              <div className={`mt-1 text-sm font-medium ${winnersPercentage >= 50 ? 'text-green-400' : 'text-red-400'}`}>{winnersPercentage}%</div>
            </div>

            <div className={`bg-white/5 rounded-xl shadow-md border-l-4 ${faultsPercentage <= 50 ? 'border-green-500' : 'border-red-500'} p-4 hover:bg-white/10 transition-all`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Fautes</div>
                <X className={`w-5 h-5 ${faultsPercentage <= 50 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <div className="text-3xl font-bold text-white">{stats.totalFaults}</div>
              <div className={`mt-1 text-sm font-medium ${faultsPercentage <= 50 ? 'text-green-400' : 'text-red-400'}`}>{faultsPercentage}%</div>
            </div>

            <div className="bg-white/5 rounded-xl shadow-md border-l-4 border-blue-500 p-4 hover:bg-white/10 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Durée Moy.</div>
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-white">{stats.avgDurationPoints}s</div>
              <div className="mt-1 text-sm text-blue-400 font-medium">Max: {stats.maxDurationPoint}s</div>
            </div>

            <div className="bg-white/5 rounded-xl shadow-md border-l-4 border-gray-500 p-4 hover:bg-white/10 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Points</div>
                <TrendingUp className="w-5 h-5 text-gray-500" />
              </div>
              <div className="text-3xl font-bold text-white">{stats.totalPoints}</div>
              <div className="mt-1 text-sm text-gray-600 font-medium">&nbsp;</div>
            </div>
          </div>

          {/* Break Point / Game Point / Set Point Badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Break Points */}
            <div className="bg-white/5 rounded-xl shadow-md border-l-4 border-orange-500 p-4 hover:bg-white/10 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Break Points</div>
                <Zap className="w-5 h-5 text-orange-500" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">BP {match.player_name}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {stats.breakPointsConverted}/{stats.breakPointsTotal}
                    {stats.breakPointsTotal > 0 && (
                      <span className="ml-1 text-orange-600">({Math.round((stats.breakPointsConverted / stats.breakPointsTotal) * 100)}%)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">BP Adversaire</span>
                  <span className="text-sm font-bold text-gray-900">
                    {stats.breakPointsDefendedConverted}/{stats.breakPointsDefendedTotal}
                    {stats.breakPointsDefendedTotal > 0 && (
                      <span className="ml-1 text-orange-600">({Math.round((stats.breakPointsDefendedConverted / stats.breakPointsDefendedTotal) * 100)}%)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Game Points */}
            <div className="bg-white/5 rounded-xl shadow-md border-l-4 border-blue-500 p-4 hover:bg-white/10 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Game Points</div>
                <Crosshair className="w-5 h-5 text-blue-500" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">GP {match.player_name}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {stats.gamePointsConverted}/{stats.gamePointsTotal}
                    {stats.gamePointsTotal > 0 && (
                      <span className="ml-1 text-blue-400">({Math.round((stats.gamePointsConverted / stats.gamePointsTotal) * 100)}%)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">GP Adversaire</span>
                  <span className="text-sm font-bold text-gray-900">
                    {stats.adversaireGamePointsConverted}/{stats.adversaireGamePointsTotal}
                    {stats.adversaireGamePointsTotal > 0 && (
                      <span className="ml-1 text-blue-400">({Math.round((stats.adversaireGamePointsConverted / stats.adversaireGamePointsTotal) * 100)}%)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Set Points */}
            <div className="bg-white/5 rounded-xl shadow-md border-l-4 border-teal-500 p-4 hover:bg-white/10 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Set Points</div>
                <Target className="w-5 h-5 text-teal-500" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">SP {match.player_name}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {stats.setPointsConverted}/{stats.setPointsTotal}
                    {stats.setPointsTotal > 0 && (
                      <span className="ml-1 text-teal-600">({Math.round((stats.setPointsConverted / stats.setPointsTotal) * 100)}%)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">SP Adversaire</span>
                  <span className="text-sm font-bold text-gray-900">
                    {stats.adversaireSetPointsConverted}/{stats.adversaireSetPointsTotal}
                    {stats.adversaireSetPointsTotal > 0 && (
                      <span className="ml-1 text-teal-600">({Math.round((stats.adversaireSetPointsConverted / stats.adversaireSetPointsTotal) * 100)}%)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>


          {/* Skill Stats */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Pourcentage de Winners par Compétence</h4>

            {chartData.length === 0 ? (
              <div className="bg-white/5 rounded-lg p-8 text-center">
                <BarChart2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-400">Aucune donnée de scoring disponible pour ce match</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mirrored Bar Chart */}
                <div className="bg-white/5 rounded-lg shadow p-4">
                  <div className="flex items-center justify-center gap-6 mb-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-red-400" />
                      <span className="text-xs font-medium text-gray-300">Fautes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[#C8F135]" />
                      <span className="text-xs font-medium text-gray-300">Winners</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {['forehand', 'backhand', 'service', 'volley', 'return', 'opponent'].map(skill => {
                      const s = stats.skillStats[skill];
                      if (!s) return null;
                      const winPct = s.percentage || 0;
                      const lossPct = s.faultPercentage || 0;
                      return (
                        <div key={skill}>
                          <div className="text-center text-xs font-bold text-white uppercase tracking-wide mb-1">{skill}</div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-red-400 w-8 text-right shrink-0">{lossPct}%</span>
                            <div className="flex-1 flex h-6 bg-white/10 rounded overflow-hidden">
                              <div className="flex-1 flex justify-end">
                                <div
                                  className="bg-red-400 h-full rounded-l flex items-center justify-center transition-all"
                                  style={{ width: `${lossPct}%`, minWidth: lossPct > 0 ? '28px' : '0' }}
                                >
                                  {lossPct > 0 && (
                                    <span className="text-[10px] font-bold text-white px-1 whitespace-nowrap">
                                      {s.faults}/{s.total}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="w-px bg-white/20 shrink-0" />
                              <div className="flex-1 flex justify-start">
                                <div
                                  className="bg-[#C8F135] h-full rounded-r flex items-center justify-center transition-all"
                                  style={{ width: `${winPct}%`, minWidth: winPct > 0 ? '28px' : '0' }}
                                >
                                  {winPct > 0 && (
                                    <span className="text-[10px] font-bold text-white px-1 whitespace-nowrap">
                                      {s.winners}/{s.total}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-[#C8F135] w-8 shrink-0">{winPct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Radar Chart with Win/Loss Toggle */}
                <div className="w-full bg-white/5 rounded-lg shadow p-4">
                  <div className="flex justify-center gap-2 mb-4">
                    <button
                      onClick={() => setSkillDataType('win')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        skillDataType === 'win'
                          ? 'bg-[#C8F135] text-black'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      Win
                    </button>
                    <button
                      onClick={() => setSkillDataType('loss')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        skillDataType === 'loss'
                          ? 'bg-red-500 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      Loss
                    </button>
                  </div>
                  <div className="w-full h-64 flex items-center justify-center">
                    <div className="w-full max-w-xs h-full">
                      <RadarChart
                        data={{
                          labels: ['Forehand', 'Backhand', 'Service', 'Volley', 'Return', 'Opponent'],
                          datasets: [
                            {
                              label: skillDataType === 'win' ? 'Winners %' : 'Faults %',
                              data: skillDataType === 'win' ? [
                                stats.skillStats.forehand?.percentage || 0,
                                stats.skillStats.backhand?.percentage || 0,
                                stats.skillStats.service?.percentage || 0,
                                stats.skillStats.volley?.percentage || 0,
                                stats.skillStats.return?.percentage || 0,
                                stats.skillStats.opponent?.percentage || 0,
                              ] : [
                                stats.skillStats.forehand?.faultPercentage || 0,
                                stats.skillStats.backhand?.faultPercentage || 0,
                                stats.skillStats.service?.faultPercentage || 0,
                                stats.skillStats.volley?.faultPercentage || 0,
                                stats.skillStats.return?.faultPercentage || 0,
                                stats.skillStats.opponent?.faultPercentage || 0,
                              ],
                              backgroundColor: skillDataType === 'win' ? 'rgba(200, 241, 53, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              borderColor: skillDataType === 'win' ? 'rgba(200, 241, 53, 1)' : 'rgba(239, 68, 68, 1)',
                              borderWidth: 2,
                              pointBackgroundColor: skillDataType === 'win' ? 'rgba(200, 241, 53, 1)' : 'rgba(239, 68, 68, 1)',
                              pointBorderColor: '#fff',
                              pointHoverBackgroundColor: '#fff',
                              pointHoverBorderColor: skillDataType === 'win' ? 'rgba(200, 241, 53, 1)' : 'rgba(239, 68, 68, 1)',
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
                                stepSize: 20,
                                color: 'rgba(255, 255, 255, 0.5)',
                                backdropColor: 'transparent',
                                font: { size: 10 }
                              },
                              grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                              },
                              pointLabels: {
                                color: 'rgba(255, 255, 255, 0.7)',
                                font: { size: 11, weight: '600' }
                              },
                              angleLines: {
                                color: 'rgba(255, 255, 255, 0.1)',
                              }
                            },
                          },
                          plugins: {
                            legend: {
                              display: false,
                            },
                            tooltip: {
                              backgroundColor: 'rgba(5, 13, 26, 0.9)',
                              titleColor: '#C8F135',
                              bodyColor: '#fff',
                              borderColor: 'rgba(200, 241, 53, 0.3)',
                              borderWidth: 1,
                              padding: 10,
                              displayColors: false,
                              callbacks: {
                                label: (context) => `${context.parsed.r}%`
                              }
                            }
                          },
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Point by Point Analysis */}
          {chartData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">Analyse Point par Point</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedGraphType('winners-errors')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedGraphType === 'winners-errors'
                        ? 'bg-[#C8F135] text-black'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    Winners/Fautes
                  </button>
                  <button
                    onClick={() => setSelectedGraphType('duration')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedGraphType === 'duration'
                        ? 'bg-[#C8F135] text-black'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    Durée
                  </button>
                </div>
              </div>

              {(selectedGraphType === 'winners-errors' || selectedGraphType === 'duration') && (
                <div className="space-y-3 mb-4">
                  {selectedGraphType === 'winners-errors' && (
                  <div className="flex flex-wrap gap-2">
                    {['forehand', 'backhand', 'volley', 'service', 'return', 'opponent'].map(skill => (
                      <button
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all duration-200 transform hover:scale-105 ${
                          selectedShotFilter === skill
                            ? 'text-white shadow-md hover:shadow-lg'
                            : 'bg-white/5 text-gray-300 border border-white/20 hover:border-white/40'
                        }`}
                        style={{
                          backgroundColor: selectedShotFilter === skill ? getSkillColor(skill) : undefined,
                          boxShadow: selectedShotFilter === skill ? `0 4px 12px ${getSkillColor(skill)}30` : undefined,
                        }}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => togglePointImportance('breakPoints')}
                      className={`group relative px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        selectedPointImportance === 'breakPoints'
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/30 hover:shadow-lg hover:shadow-orange-500/40 transform hover:scale-105'
                          : 'bg-white/5 text-gray-300 border border-white/20 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50'
                      }`}
                    >
                      Break Points
                    </button>
                    <button
                      onClick={() => togglePointImportance('gamePoints')}
                      className={`group relative px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        selectedPointImportance === 'gamePoints'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40 transform hover:scale-105'
                          : 'bg-white/5 text-gray-300 border border-white/20 hover:border-blue-400 hover:text-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      Game Points
                    </button>
                    <button
                      onClick={() => togglePointImportance('setPoints')}
                      className={`group relative px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        selectedPointImportance === 'setPoints'
                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-md shadow-yellow-500/30 hover:shadow-lg hover:shadow-yellow-500/40 transform hover:scale-105'
                          : 'bg-white/5 text-gray-300 border border-white/20 hover:border-yellow-400 hover:text-yellow-600 hover:bg-yellow-50'
                      }`}
                    >
                      Set Points
                    </button>
                  </div>
                </div>
              )}

              {selectedGraphType === 'winners-errors' ? (
                <div
                  ref={graphContainerRef}
                  className="bg-white/5 rounded-lg p-6 overflow-x-auto"
                  style={{ position: 'relative', zIndex: 1 }}
                  onClick={() => {
                    setSelectedPoint(null);
                    setClickPosition(null);
                  }}
                >
                  {/* Scoreboard Overlay */}
                  {selectedPoint !== null && (() => {
                    const point = chartData.find(p => p.index === selectedPoint);
                    if (!point) return null;

                    // Calculate vertical center position (120px padding + center of content)
                    const containerCenterY = 120;

                    return (
                      <div
                        className="absolute bg-[#050d1a]/95 backdrop-blur-sm rounded shadow-xl border border-[#C8F135] p-1.5"
                        style={{
                          zIndex: 10000,
                          minWidth: '112px',
                          maxWidth: '280px',
                          left: clickPosition ? `${clickPosition.x}px` : '50%',
                          top: `${containerCenterY}px`,
                          transform: 'translate(0, -50%)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                      >
                          <div className="flex flex-col gap-1">
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="text-[9px] font-semibold text-white leading-tight">
                                  Point {point.index}: {point.action} - {point.skill}
                                </div>
                                {point.videoUrl && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCurrentVideoUrl(point.videoUrl);
                                      setVideoModalOpen(true);
                                    }}
                                    className="flex items-center justify-center w-9 h-9 min-w-[36px] min-h-[36px] bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-full shadow-md transition-all transform hover:scale-110 active:scale-95"
                                  >
                                    <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
                                  </button>
                                )}
                              </div>
                              <div className="text-[8px] text-gray-400 mt-0.5">
                                Serveur: {point.server === 'famille' ? match.player_name : 'Adversaire'}
                              </div>
                            </div>

                            <div className="flex flex-wrap justify-center items-center gap-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigatePoint('prev');
                                }}
                                onTouchEnd={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  navigatePoint('prev');
                                }}
                                className="flex items-center justify-center w-7 h-7 min-w-[28px] min-h-[28px] bg-[#C8F135] hover:bg-[#b8e125] text-black rounded-full shadow transition-all transform hover:scale-110 active:scale-95 touch-manipulation cursor-pointer"
                                style={{ touchAction: 'manipulation' }}
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              {point.duration > 0 && (
                                <span className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                  <Clock className="w-2.5 h-2.5" />
                                  {point.duration.toFixed(0)}s
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigatePoint('next');
                                }}
                                onTouchEnd={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  navigatePoint('next');
                                }}
                                className="flex items-center justify-center w-7 h-7 min-w-[28px] min-h-[28px] bg-[#C8F135] hover:bg-[#b8e125] text-black rounded-full shadow transition-all transform hover:scale-110 active:scale-95 touch-manipulation cursor-pointer"
                                style={{ touchAction: 'manipulation' }}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                              {point.isMatchPoint && (
                                <span className="px-1 py-0.5 bg-red-100 text-red-700 text-[7px] font-semibold rounded-full border border-red-300">
                                  Match Point
                                </span>
                              )}
                              {point.isBreakPoint && !point.isMatchPoint && (
                                <span className="flex items-center gap-0.5 px-1 py-0.5 bg-orange-100 text-orange-700 text-[7px] font-semibold rounded-full border border-orange-300">
                                  BP {point.breakPointPlayer === 'famille' ? match.player_name : 'Adv'}
                                  {point.breakPointNumber > 0 && (
                                    <span className="flex items-center justify-center w-3 h-3 bg-orange-500 text-white rounded-full text-[7px] font-bold">
                                      {point.breakPointNumber}
                                    </span>
                                  )}
                                </span>
                              )}
                              {point.isSetPoint && !point.isMatchPoint && (
                                <span className="px-1 py-0.5 bg-yellow-100 text-yellow-700 text-[7px] font-semibold rounded-full border border-yellow-300">
                                  Set Point
                                </span>
                              )}
                              {point.isGamePoint && !point.isSetPoint && !point.isMatchPoint && !point.isBreakPoint && (
                                <span className="flex items-center gap-0.5 px-1 py-0.5 bg-blue-100 text-blue-700 text-[7px] font-semibold rounded-full border border-blue-300">
                                  GP {point.gamePointPlayer === 'famille' ? match.player_name : point.gamePointPlayer === 'adversaire' ? 'Adv' : ''}
                                  {point.gamePointNumber > 0 && (
                                    <span className="flex items-center justify-center w-3 h-3 bg-blue-500 text-white rounded-full text-[7px] font-bold">
                                      {point.gamePointNumber}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>

                            <InlineScoreboard
                              setScores={point.setScores}
                              gameScore={point.gameScore}
                              size="small"
                              server={point.server}
                              playerName={match?.player_name || 'Joueur'}
                            />
                          </div>
                        </div>
                      );
                    })()}

                  <div className="relative flex gap-1 min-w-max" style={{ paddingTop: '120px', paddingBottom: '120px', overflow: 'visible' }}>
                    {/* Zero axis line */}
                    <div className="absolute left-0 right-0 h-px bg-white/20" style={{ top: '50%', transform: 'translateY(-50%)' }} />

                    {chartData.map((point) => {
                      const isSelected = selectedPoint === point.index;
                      const isHighlighted = highlightedBarIndex === point.index;
                      const baseWidth = 8;
                      const maxWidth = 40;
                      const barWidth = point.duration > 0
                        ? Math.max(baseWidth, Math.min(maxWidth, baseWidth + (point.duration - minDuration) / (maxDuration - minDuration) * (maxWidth - baseWidth)))
                        : baseWidth;

                      return (
                        <div
                          key={point.index}
                          ref={(el) => {
                            if (el) barRefs.current.set(point.index, el);
                          }}
                          className="relative flex flex-col items-center justify-center"
                          style={{ width: `${barWidth}px`, minWidth: `${barWidth}px` }}
                        >
                          {/* Winners - Top */}
                          <div className="absolute bottom-1/2 flex flex-col items-center justify-end mb-0.5">
                            {point.isWinner && (
                              <div
                                className={`bar-clickable rounded cursor-pointer hover:opacity-80 transition-all ${
                                  isSelected ? 'ring-4 ring-blue-500 ring-opacity-70' : ''
                                } ${isHighlighted ? 'ring-4 ring-green-500 ring-opacity-90' : ''}`}
                                style={{
                                  width: `${barWidth}px`,
                                  height: '80px',
                                  backgroundColor: getSkillColor(point.skill),
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedPoint === point.index) {
                                    setSelectedPoint(null);
                                    setClickPosition(null);
                                  } else {
                                    const target = e.currentTarget as HTMLElement;
                                    const rect = target.getBoundingClientRect();
                                    // Find the scrollable parent container
                                    const scrollContainer = target.closest('.overflow-x-auto') as HTMLElement;
                                    if (scrollContainer) {
                                      const containerRect = scrollContainer.getBoundingClientRect();
                                      // Position to the right of the bar relative to container
                                      const relativeX = rect.right - containerRect.left + scrollContainer.scrollLeft + 5;
                                      const relativeY = rect.top + rect.height / 2 - containerRect.top + scrollContainer.scrollTop;
                                      setClickPosition({ x: relativeX, y: relativeY });
                                    }
                                    setSelectedPoint(point.index);
                                  }
                                }}
                              />
                            )}
                          </div>

                          {/* Point marker and number */}
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                            {point.isMatchPoint && (
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white shadow-md" title="Match Point" />
                            )}
                            {!point.isMatchPoint && point.isBreakPoint && (
                              <Zap className="w-3.5 h-3.5 text-orange-500 fill-orange-500 drop-shadow-md" title="Break Point" />
                            )}
                            {!point.isMatchPoint && !point.isBreakPoint && point.isSetPoint && (
                              <Medal className="w-3.5 h-3.5 text-yellow-500 drop-shadow-md" title="Set Point" />
                            )}
                            {!point.isMatchPoint && !point.isBreakPoint && !point.isSetPoint && point.isGamePoint && (
                              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-md" title="Game Point" />
                            )}
                            <span className="text-[10px] text-gray-300 mt-6 whitespace-nowrap">{point.index}</span>
                          </div>

                          {/* Faults - Bottom */}
                          <div className="absolute top-1/2 flex flex-col items-center justify-start mt-0.5">
                            {point.isFault && (
                              <div
                                className={`bar-clickable rounded cursor-pointer hover:opacity-80 transition-all ${
                                  isSelected ? 'ring-4 ring-blue-500 ring-opacity-70' : ''
                                } ${isHighlighted ? 'ring-4 ring-green-500 ring-opacity-90' : ''}`}
                                style={{
                                  width: `${barWidth}px`,
                                  height: '80px',
                                  backgroundColor: getSkillColor(point.skill),
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedPoint === point.index) {
                                    setSelectedPoint(null);
                                    setClickPosition(null);
                                  } else {
                                    const target = e.currentTarget as HTMLElement;
                                    const rect = target.getBoundingClientRect();
                                    // Find the scrollable parent container
                                    const scrollContainer = target.closest('.overflow-x-auto') as HTMLElement;
                                    if (scrollContainer) {
                                      const containerRect = scrollContainer.getBoundingClientRect();
                                      // Position to the right of the bar relative to container
                                      const relativeX = rect.right - containerRect.left + scrollContainer.scrollLeft + 5;
                                      const relativeY = rect.top + rect.height / 2 - containerRect.top + scrollContainer.scrollTop;
                                      setClickPosition({ x: relativeX, y: relativeY });
                                    }
                                    setSelectedPoint(point.index);
                                  }
                                }}
                              />
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div
                  className="bg-white/5 rounded-lg p-6 relative"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <div style={{ height: '240px' }}>
                    <Bar
                      data={{
                        labels: filteredChartData.map(p => p.index),
                        datasets: [
                          {
                            label: 'Durée (secondes)',
                            data: filteredChartData.map(p => p.duration),
                            backgroundColor: filteredChartData.map((point) => {
                              if (point.isMatchPoint) return 'rgba(239, 68, 68, 0.8)';
                              if (point.isSetPoint) return 'rgba(34, 197, 94, 0.8)';
                              if (point.isGamePoint) return 'rgba(59, 130, 246, 0.8)';
                              return 'rgba(99, 102, 241, 0.8)';
                            }),
                            borderColor: filteredChartData.map((point) => {
                              if (point.isMatchPoint) return 'rgba(239, 68, 68, 1)';
                              if (point.isSetPoint) return 'rgba(34, 197, 94, 1)';
                              if (point.isGamePoint) return 'rgba(59, 130, 246, 1)';
                              return 'rgba(99, 102, 241, 1)';
                            }),
                            borderWidth: 1,
                            borderRadius: 4,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        onClick: (event, elements, chart) => {
                          if (elements.length > 0) {
                            const index = elements[0].index;
                            const element = elements[0];

                            // Get the bar's center x position
                            const barX = element.element.x;
                            const barY = element.element.y;

                            setClickPosition({ x: barX, y: barY });
                            setSelectedPoint(filteredChartData[index].index);
                          } else {
                            // Clicked outside a bar, close the popup
                            setSelectedPoint(null);
                            setClickPosition(null);
                          }
                        },
                        scales: {
                          x: {
                            title: {
                              display: true,
                              text: 'Point #',
                              font: {
                                size: 12,
                                weight: 'bold',
                              },
                            },
                            ticks: {
                              maxRotation: 0,
                              autoSkip: true,
                              maxTicksLimit: 20,
                            },
                          },
                          y: {
                            beginAtZero: true,
                            title: {
                              display: true,
                              text: 'Durée (secondes)',
                              font: {
                                size: 12,
                                weight: 'bold',
                              },
                            },
                            ticks: {
                              callback: (value) => value + 's',
                            },
                          },
                        },
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            cornerRadius: 8,
                            titleFont: {
                              size: 13,
                              weight: 'bold',
                            },
                            bodyFont: {
                              size: 12,
                            },
                            callbacks: {
                              title: (context) => {
                                const point = filteredChartData[context[0].dataIndex];
                                return `Point ${point.index}`;
                              },
                              label: (context) => {
                                const point = filteredChartData[context.dataIndex];
                                const resultLabel = point.player === 'famille' ? 'Point gagné' : 'Point perdu';
                                const labels = [
                                  `Durée: ${point.duration.toFixed(1)}s`,
                                  `${resultLabel} (${point.skill}: ${point.action})`,
                                ];
                                if (point.isMatchPoint) labels.push('🔴 Match Point');
                                else if (point.isSetPoint) labels.push('🟢 Set Point');
                                else if (point.isGamePoint) labels.push('🔵 Game Point');
                                return labels;
                              },
                              afterLabel: (context) => {
                                const point = filteredChartData[context.dataIndex];
                                const setScore = `Set: ${point.setScores.famille.join('-')} vs ${point.setScores.adversaire.join('-')}`;
                                const gameScore = `Game: ${point.gameScore.famille}-${point.gameScore.adversaire}`;
                                return [setScore, gameScore];
                              },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                  {selectedPoint !== null && (() => {
                    const point = chartData.find(p => p.index === selectedPoint);
                    if (!point) return null;
                    return (
                      <div
                        className="absolute bg-[#050d1a]/95 backdrop-blur-sm rounded shadow-xl border border-[#C8F135] p-1.5"
                        style={{
                          zIndex: 10000,
                          minWidth: '112px',
                          maxWidth: '280px',
                          left: clickPosition ? `${clickPosition.x + 5}px` : '50%',
                          top: clickPosition ? `${clickPosition.y - 60}px` : 'auto',
                          bottom: clickPosition ? 'auto' : '45px',
                          transform: clickPosition ? 'translateX(-50%)' : 'translateX(-50%)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="text-center">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  point.player === 'famille'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {point.player === 'famille' ? 'Point gagné' : 'Point perdu'}
                                </span>
                                {point.videoUrl && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCurrentVideoUrl(point.videoUrl);
                                      setVideoModalOpen(true);
                                    }}
                                    className="flex items-center justify-center w-9 h-9 min-w-[36px] min-h-[36px] bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-full shadow-md transition-all transform hover:scale-110 active:scale-95"
                                  >
                                    <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
                                  </button>
                                )}
                              </div>
                              <div className="text-[9px] font-medium text-gray-400">
                                Point {point.index}: {point.action} - {point.skill}
                              </div>
                              <div className="text-[8px] text-gray-400 mt-0.5">
                                Serveur: {point.server === 'famille' ? match.player_name : 'Adversaire'}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap justify-center items-center gap-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigatePoint('prev');
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                navigatePoint('prev');
                              }}
                              className="flex items-center justify-center w-7 h-7 min-w-[28px] min-h-[28px] bg-[#C8F135] hover:bg-[#b8e125] text-black rounded-full shadow transition-all transform hover:scale-110 active:scale-95 touch-manipulation cursor-pointer"
                              style={{ touchAction: 'manipulation' }}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            {point.duration > 0 && (
                              <span className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                <Clock className="w-2.5 h-2.5" />
                                {point.duration.toFixed(0)}s
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigatePoint('next');
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                navigatePoint('next');
                              }}
                              className="flex items-center justify-center w-7 h-7 min-w-[28px] min-h-[28px] bg-[#C8F135] hover:bg-[#b8e125] text-black rounded-full shadow transition-all transform hover:scale-110 active:scale-95 touch-manipulation cursor-pointer"
                              style={{ touchAction: 'manipulation' }}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                            {point.isMatchPoint && (
                              <span className="px-1 py-0.5 bg-red-100 text-red-700 text-[7px] font-semibold rounded-full border border-red-300">
                                Match Point
                              </span>
                            )}
                            {point.isBreakPoint && !point.isMatchPoint && (
                              <span className="flex items-center gap-0.5 px-1 py-0.5 bg-orange-100 text-orange-700 text-[7px] font-semibold rounded-full border border-orange-300">
                                BP {point.breakPointPlayer === 'famille' ? match.player_name : 'Adv'}
                                {point.breakPointNumber > 0 && (
                                  <span className="flex items-center justify-center w-3 h-3 bg-orange-500 text-white rounded-full text-[7px] font-bold">
                                    {point.breakPointNumber}
                                  </span>
                                )}
                              </span>
                            )}
                            {point.isSetPoint && !point.isMatchPoint && (
                              <span className="px-1 py-0.5 bg-yellow-100 text-yellow-700 text-[7px] font-semibold rounded-full border border-yellow-300">
                                Set Point
                              </span>
                            )}
                            {point.isGamePoint && !point.isSetPoint && !point.isMatchPoint && !point.isBreakPoint && (
                              <span className="flex items-center gap-0.5 px-1 py-0.5 bg-blue-100 text-blue-700 text-[7px] font-semibold rounded-full border border-blue-300">
                                GP {point.gamePointPlayer === 'famille' ? match.player_name : point.gamePointPlayer === 'adversaire' ? 'Adv' : ''}
                                {point.gamePointNumber > 0 && (
                                  <span className="flex items-center justify-center w-3 h-3 bg-blue-500 text-white rounded-full text-[7px] font-bold">
                                    {point.gamePointNumber}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>

                          <InlineScoreboard
                            setScores={point.setScores}
                            gameScore={point.gameScore}
                            size="small"
                            server={point.server}
                            playerName={match?.player_name || 'Joueur'}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* History Log Section */}
              {selectedGraphType === 'winners-errors' && (selectedShotFilter || selectedPointImportance) && (
                <div className="mt-6 bg-white/5 rounded-lg border border-white/20 shadow-sm">
                  <div className="px-4 py-3 border-b border-white/10 bg-white/5">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-bold text-white uppercase tracking-wide">
                        Points Filtrés
                        {(selectedShotFilter || selectedPointImportance) && (
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            {[
                              selectedShotFilter && selectedShotFilter.charAt(0).toUpperCase() + selectedShotFilter.slice(1),
                              selectedPointImportance === 'breakPoints' && 'Break Points',
                              selectedPointImportance === 'gamePoints' && 'Game Points',
                              selectedPointImportance === 'setPoints' && 'Set Points'
                            ].filter(Boolean).join(' + ')}
                          </span>
                        )}
                      </h5>
                      <span className="flex items-center justify-center w-7 h-7 bg-blue-500 text-white rounded-full text-xs font-bold shadow-sm">
                        {historyFilteredData.length}
                      </span>
                    </div>
                  </div>
                  <div ref={historyContainerRef} className="p-4 max-h-96 overflow-y-auto">
                    {/* Radar Chart for Filtered Points */}
                    {selectedPointImportance && historyFilteredData.length > 0 && (() => {
                      const filteredSkillStats = calculateFilteredSkillStats(historyFilteredData);
                      return (
                        <div className="flex justify-center items-center pb-4 mb-4 border-b border-white/10">
                          <div className="w-56 h-56">
                            <RadarChart
                              data={{
                                labels: ['Forehand', 'Backhand', 'Service', 'Volley', 'Return', 'Opponent'],
                                datasets: [
                                  {
                                    label: 'Win %',
                                    data: [
                                      filteredSkillStats.wins.forehand,
                                      filteredSkillStats.wins.backhand,
                                      filteredSkillStats.wins.service,
                                      filteredSkillStats.wins.volley,
                                      filteredSkillStats.wins.return,
                                      filteredSkillStats.wins.opponent,
                                    ],
                                    backgroundColor: 'rgba(200, 241, 53, 0.2)',
                                    borderColor: 'rgba(200, 241, 53, 1)',
                                    borderWidth: 2,
                                    pointBackgroundColor: 'rgba(200, 241, 53, 1)',
                                    pointBorderColor: '#fff',
                                    pointHoverBackgroundColor: '#fff',
                                    pointHoverBorderColor: 'rgba(200, 241, 53, 1)',
                                  },
                                  {
                                    label: 'Loss %',
                                    data: [
                                      filteredSkillStats.losses.forehand,
                                      filteredSkillStats.losses.backhand,
                                      filteredSkillStats.losses.service,
                                      filteredSkillStats.losses.volley,
                                      filteredSkillStats.losses.return,
                                      filteredSkillStats.losses.opponent,
                                    ],
                                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                    borderColor: 'rgba(239, 68, 68, 1)',
                                    borderWidth: 2,
                                    pointBackgroundColor: 'rgba(239, 68, 68, 1)',
                                    pointBorderColor: '#fff',
                                    pointHoverBackgroundColor: '#fff',
                                    pointHoverBorderColor: 'rgba(239, 68, 68, 1)',
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
                                      color: 'rgba(255, 255, 255, 0.5)',
                                      font: { size: 10 },
                                      backdropColor: 'transparent',
                                    },
                                    grid: {
                                      color: 'rgba(255, 255, 255, 0.1)',
                                    },
                                    angleLines: {
                                      color: 'rgba(255, 255, 255, 0.1)',
                                    },
                                    pointLabels: {
                                      color: 'rgba(255, 255, 255, 0.7)',
                                      font: { size: 11, weight: 'bold' },
                                    },
                                  },
                                },
                                plugins: {
                                  legend: {
                                    display: true,
                                    position: 'bottom',
                                    labels: {
                                      color: '#475569',
                                      font: { size: 11 },
                                      padding: 8,
                                      usePointStyle: true,
                                      pointStyle: 'circle',
                                    },
                                  },
                                  tooltip: {
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    titleColor: '#e2e8f0',
                                    bodyColor: '#e2e8f0',
                                    borderColor: '#475569',
                                    borderWidth: 1,
                                    callbacks: {
                                      label: (context) => {
                                        return `${context.dataset.label}: ${context.parsed.r.toFixed(1)}%`;
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
                      {historyFilteredData.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm italic">
                          Aucun point trouvé pour ce filtre
                        </div>
                      ) : (
                        historyFilteredData.map((point, idx) => {
                          const isHighlighted = highlightedBarIndex === point.index;

                          return (
                            <div
                              key={point.index}
                              onClick={() => {
                                setHighlightedBarIndex(point.index);
                                scrollToBar(point.index);
                              }}
                              className={`rounded-lg shadow-sm border p-3 flex gap-3 items-start cursor-pointer transition-all ${
                                isHighlighted
                                  ? 'bg-green-50 border-green-600 ring-2 ring-green-500'
                                  : 'bg-gray-50 border-white/20 hover:border-green-500 hover:bg-green-50/50'
                              }`}
                            >
                              <div className="w-16 h-16 bg-black rounded flex items-center justify-center shrink-0 overflow-hidden relative">
                                {point.videoUrl ? (
                                  <>
                                    <video src={point.videoUrl} className="w-full h-full object-cover" muted playsInline />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentVideoUrl(point.videoUrl);
                                        setVideoModalOpen(true);
                                      }}
                                    >
                                      <Play className="text-white w-6 h-6 opacity-80 fill-white" />
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-gray-400">
                                    <Video className="w-6 h-6" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1 gap-2">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    point.player === 'famille'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {point.player === 'famille' ? 'Point gagné' : 'Point perdu'}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    {point.duration > 0 && (
                                      <span className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                        <Clock className="w-2.5 h-2.5" />
                                        {point.duration.toFixed(0)}s
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-1">
                                  <p className="text-xs text-gray-500 mb-0.5">
                                    Serveur: {point.server === 'famille' ? match.player_name : 'Adversaire'}
                                  </p>
                                  <p className="font-semibold text-gray-800 text-sm">
                                    Point {point.index} - {point.action}: {point.skill}
                                  </p>
                                  {point.gameScore && point.setScores ? (
                                    <div className="mt-2">
                                      <InlineScoreboard
                                        setScores={point.setScores}
                                        gameScore={point.gameScore}
                                        size="small"
                                        playerName={match.player_name}
                                        server={point.server}
                                      />
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-600 mt-1">N/A</p>
                                  )}
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {point.isMatchPoint && (
                                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded-full border border-red-300">
                                        Match Point
                                      </span>
                                    )}
                                    {point.isBreakPoint && !point.isMatchPoint && (
                                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded-full border border-orange-300">
                                        Break Point {point.breakPointPlayer === 'famille' ? match.player_name : 'Adversaire'}
                                        {point.breakPointNumber > 0 && (
                                          <span className="flex items-center justify-center w-4 h-4 bg-orange-500 text-white rounded-full text-[9px] font-bold">
                                            {point.breakPointNumber}
                                          </span>
                                        )}
                                      </span>
                                    )}
                                    {point.isSetPoint && !point.isMatchPoint && (
                                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-semibold rounded-full border border-yellow-300">
                                        Set Point {point.setPointPlayer === 'famille' ? match.player_name : point.setPointPlayer === 'adversaire' ? 'Adversaire' : ''}
                                      </span>
                                    )}
                                    {point.isGamePoint && !point.isSetPoint && !point.isMatchPoint && !point.isBreakPoint && (
                                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-full border border-blue-300">
                                        Game Point {point.gamePointPlayer === 'famille' ? match.player_name : point.gamePointPlayer === 'adversaire' ? 'Adversaire' : ''}
                                        {point.gamePointNumber > 0 && (
                                          <span className="flex items-center justify-center w-4 h-4 bg-blue-500 text-white rounded-full text-[9px] font-bold">
                                            {point.gamePointNumber}
                                          </span>
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {chartData.length === 0 && (
            <div className="bg-white/5 rounded-lg p-8 text-center">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-400">Aucune donnée de scoring disponible pour ce match</p>
            </div>
          )}
        </div>
      </div>

      {/* Video Player Modal */}
      {videoModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4"
          style={{ zIndex: 100 }}
          onClick={() => setVideoModalOpen(false)}
        >
          <div
            className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Vidéo du Point</h3>
              </div>
              <button
                onClick={() => setVideoModalOpen(false)}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setVideoModalOpen(false);
                }}
                className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg touch-manipulation cursor-pointer"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 bg-black">
              <video
                src={currentVideoUrl}
                controls
                autoPlay
                className="w-full rounded-lg shadow-2xl"
                style={{ maxHeight: '70vh' }}
              />
            </div>

            <div className="p-4 bg-slate-800/50 border-t border-slate-700">
              <p className="text-sm text-slate-400 text-center">
                Cliquez en dehors de la vidéo pour fermer
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
