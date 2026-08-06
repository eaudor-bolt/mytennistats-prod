import { useState, useEffect, useRef, useMemo } from 'react';
import { X, ArrowLeft, Trophy, Share2, Lock, Unlock, Camera, StopCircle, Settings, Clock, Upload, CheckCircle, Eye, EyeOff, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePlayers } from '../contexts/PlayersContext';
import { uploadVideoToS3, toFinalVideoUrl } from '../utils/s3Upload';
import { MiniScoreboard } from './MiniScoreboard';
import { VideoPlayerModal } from './VideoPlayerModal';
import { GaugeBar } from './GaugeBar';
import { LiveScoreHelpButton, LiveScoreHelpTour } from './LiveScoreHelpTour';
import { useAlert } from '../hooks/useAlert';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubscription } from '../contexts/SubscriptionContext';

const SKILL_KEYS = ['forehand', 'backhand', 'volley', 'service', 'return', 'opponent'];

type GameScore = { adversaire: number; famille: number; totalAd?: number };
type SetScores = { adversaire: number[]; famille: number[] };

type LiveScoreModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onMatchSaved: () => void;
  onMatchFinished?: (matchData: {
    date: string;
    player_name: string;
    tournament_name: string;
    score: string;
    classement: 'NC' | '40' | '30' | '15';
    forehand: 'bad' | 'good' | 'great';
    backhand: 'bad' | 'good' | 'great';
    serve: 'bad' | 'good' | 'great';
    return: 'bad' | 'good' | 'great';
    scoring_history: any[];
    game_per_set?: 3 | 4 | 6;
    super_tiebreak?: boolean;
    no_ad?: boolean;
    retirement_player?: 'adversaire' | 'famille' | null;
  }) => void;
  /**
   * Bumped by the parent once a match handed off via `onMatchFinished` is
   * actually persisted, so this session's saved state can finally be wiped.
   * Left untouched while that hand-off is still pending (e.g. the user is on
   * the Add Match modal, or cancelled out of it) so the match can be resumed.
   */
  discardSessionToken?: number;
};

const getPlaybackUrl = (url: string | null): string | null => {
  if (!url) return null;
  return url;
};

export function LiveScoreModal({ isOpen, onClose, onMatchSaved, onMatchFinished, discardSessionToken }: LiveScoreModalProps) {
  const { t } = useLanguage();
  const { players } = usePlayers();
  const { showAlert, AlertComponent } = useAlert();
  const { canRecordLivePoint, incrementUsage } = useSubscription();
  const [showHelpTour, setShowHelpTour] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [gameScore, setGameScore] = useState<GameScore>({ adversaire: 0, famille: 0, totalAd: 0 });
  const [setScores, setSetScores] = useState<SetScores>({ adversaire: [0, 0, 0], famille: [0, 0, 0] });
  const [currentSet, setCurrentSet] = useState(0);
  const [isTiebreak, setIsTiebreak] = useState(false);
  const [isMatchFinished, setIsMatchFinished] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tiebreakScores, setTiebreakScores] = useState<Record<number, GameScore>>({});
  const [highlightedRow, setHighlightedRow] = useState<{ row: string | null; color: string | null }>({ row: null, color: null });
  const [pressedButton, setPressedButton] = useState<{ skill: string | null; type: string | null }>({ skill: null, type: null });
  const [currentServer, setCurrentServer] = useState<'famille' | 'adversaire'>('famille');
  const [gameFormat, setGameFormat] = useState({
    threeGames: false,
    fourGames: false,
    fiveGames: false,
    sixGames: true,
    supertiebreak: true,
    noAd: false,
    tiebreakAt: 6,
    formatPreset: 2,
  });
  const [scoringHistory, setScoringHistory] = useState<any[]>([]);
  const [showSetupModal, setShowSetupModal] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isLocked, setIsLocked] = useState(true);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  // Synchronous guard against rapid repeated clicks on the share button:
  // state updates (isCreatingShareLink, liveMatchId) aren't visible until the
  // next render, so a second click fired before that re-render would still
  // see liveMatchId as null and create a second live_matches row/URL.
  const isCreatingShareLinkRef = useRef(false);
  const prevGameScoreRef = useRef<GameScore>({ adversaire: 0, famille: 0 });
  const tiebreakPointCountRef = useRef(0);
  const wasTiebreakRef = useRef(false);
  const tiebreakFirstServerRef = useRef<'famille' | 'adversaire' | null>(null);
  const currentServerRef = useRef<'famille' | 'adversaire'>('famille');
  const sequenceNumberRef = useRef(0);
  const [totalAdInGame, setTotalAdInGame] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [videoQuality, setVideoQuality] = useState<'SD' | 'HD'>('HD');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingActionRef = useRef<{ skill: string; isWin: boolean } | null>(null);
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const recordingStartTimeRef = useRef<number | null>(null);
  const pointStartTimeRef = useRef<number | null>(null);
  const [uploadingEntries, setUploadingEntries] = useState<Set<number>>(new Set());
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);
  // Set when the match is ended early (via "Terminer le Match" before either
  // player has actually won) rather than reaching a natural conclusion - the
  // player who did NOT retire is the winner. Null for a normal finish.
  const [retirementPlayer, setRetirementPlayer] = useState<'adversaire' | 'famille' | null>(null);
  const [showRetirementPrompt, setShowRetirementPrompt] = useState(false);
  const isClosingRef = useRef(false);
  const networkWarningShownRef = useRef(false);
  const skipNextResetRef = useRef(false);
  const isFirstDiscardTokenRunRef = useRef(true);
  const pushedHistoryRef = useRef(false);
  const skipNextHistoryPushRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  // VideoPlayerModal (rendered nested below when a point's clip is playing)
  // registers its own popstate listener too. A single history.back() - from
  // either modal's own close action - fires BOTH listeners at once, so this
  // one must no-op while the video player is open: otherwise closing the
  // video (via its X button or a physical back) also closes this whole Live
  // Score modal, dropping the user back on the Matches page.
  const playingVideoUrlRef = useRef<string | null>(null);
  useEffect(() => { playingVideoUrlRef.current = playingVideoUrl; }, [playingVideoUrl]);

  const saveMatchState = () => {
    const state = {
      selectedPlayer,
      gameScore,
      setScores,
      currentSet,
      isTiebreak,
      scoreHistory,
      historyIndex,
      tiebreakScores,
      currentServer,
      gameFormat,
      scoringHistory,
      showSetupModal,
      liveMatchId,
      matchStartTime,
      elapsedTime,
      isMatchFinished,
      totalAdInGame,
      retirementPlayer,
    };
    localStorage.setItem('liveMatchState', JSON.stringify(state));
  };

  const loadMatchState = () => {
    const saved = localStorage.getItem('liveMatchState');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved match state', e);
      return null;
    }
  };

  const restoreMatchState = (state: any) => {
    setSelectedPlayer(state.selectedPlayer || '');
    setGameScore(state.gameScore || { adversaire: 0, famille: 0 });
    setSetScores(state.setScores || { adversaire: [0, 0, 0], famille: [0, 0, 0] });
    setCurrentSet(state.currentSet || 0);
    setIsTiebreak(state.isTiebreak || false);
    setScoreHistory(state.scoreHistory || []);
    setHistoryIndex(state.historyIndex || -1);
    setTiebreakScores(state.tiebreakScores || {});
    setCurrentServer(state.currentServer || 'famille');
    setGameFormat(state.gameFormat || {
      threeGames: false,
      fourGames: false,
      fiveGames: false,
      sixGames: true,
      supertiebreak: true,
      noAd: false,
      tiebreakAt: 6,
      formatPreset: 2,
    });
    setScoringHistory(state.scoringHistory || []);
    setShowSetupModal(state.showSetupModal !== undefined ? state.showSetupModal : true);
    setLiveMatchId(state.liveMatchId || null);
    setMatchStartTime(state.matchStartTime || null);
    setElapsedTime(state.elapsedTime || 0);
    setIsMatchFinished(state.isMatchFinished || false);
    setTotalAdInGame(state.totalAdInGame || 0);
    setRetirementPlayer(state.retirementPlayer || null);
    sequenceNumberRef.current = state.scoringHistory ? state.scoringHistory.length : 0;
    if (state.scoringHistory && state.scoringHistory.length > 0) {
      const lastEntry = state.scoringHistory[state.scoringHistory.length - 1];
      if (lastEntry.sequence) {
        sequenceNumberRef.current = lastEntry.sequence;
      }
    }
  };

  const clearMatchState = () => {
    localStorage.removeItem('liveMatchState');
  };

  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      // This component instance is never unmounted (the parent always
      // renders it, just gated by isOpen) - so without this, a video left
      // open from a previous session (e.g. the primary bugfix above no
      // longer applies once the whole modal *is* legitimately closed and
      // reopened) would still be sitting in state and resurface as soon as
      // the user resumes, instead of showing the live scoreboard.
      setPlayingVideoUrl(null);

      if (skipNextResetRef.current) {
        // Reopening after the Add Match modal was cancelled: this session's
        // state was deliberately left untouched, so just show it as-is.
        skipNextResetRef.current = false;
        return;
      }

      const savedState = loadMatchState();
      if (savedState && !savedState.isMatchFinished) {
        setShowRestorePrompt(true);
      } else {
        resetMatch();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isFirstDiscardTokenRunRef.current) {
      isFirstDiscardTokenRunRef.current = false;
      return;
    }
    clearMatchState();
    resetMatch();
  }, [discardSessionToken]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  // Handle browser back button / gesture on mobile: whether the restore
  // prompt ("Match en cours détecté") or the live scoreboard itself is
  // showing, back should close this modal and return to the Matches page,
  // not navigate the app away. Mirrors AddMatchResultModal's handling.
  useEffect(() => {
    if (!isOpen) return;

    if (skipNextHistoryPushRef.current) {
      // Reopening after the Add Match modal was cancelled: the history entry
      // pushed when this session originally opened was deliberately left
      // un-popped for this exact hand-off, so there's nothing new to push -
      // doing so anyway would leave two entries for what the user sees as
      // one continuous Live Score session.
      skipNextHistoryPushRef.current = false;
    } else {
      window.history.pushState({ modalOpen: true }, '');
      pushedHistoryRef.current = true;
    }

    const handlePopState = () => {
      if (playingVideoUrlRef.current) {
        // The nested VideoPlayerModal owns this pop: it pushed its own
        // history entry on top of ours and has its own listener that will
        // close just the video. Don't also close the Live Score modal.
        return;
      }
      pushedHistoryRef.current = false;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);

  const handleClose = () => {
    const hadPushedHistory = pushedHistoryRef.current;
    pushedHistoryRef.current = false;
    onClose();
    if (hadPushedHistory) {
      window.history.back();
    }
  };

  useEffect(() => {
    if (matchStartTime && !isMatchFinished) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - matchStartTime);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [matchStartTime, isMatchFinished]);

  useEffect(() => {
    if (liveMatchId && !showSetupModal) {
      updateLiveMatch();
    }
    if (!showSetupModal && !showRestorePrompt) {
      saveMatchState();
    }
  }, [gameScore, setScores, currentSet, isTiebreak, isMatchFinished, scoringHistory, retirementPlayer]);

  useEffect(() => {
    if (isOpen && !showSetupModal && !isCameraActive && !isClosingRef.current) {
      console.log('Effect: Starting camera');
      startCamera();
    } else if (!isOpen && isCameraActive) {
      console.log('Effect: Stopping camera (modal closed)');
      stopCamera();
    }
  }, [showSetupModal, isOpen, isCameraActive]);

  useEffect(() => {
    return () => {
      console.log('Component unmount: Cleaning up camera');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);


  useEffect(() => {
    // Auto-enable tiebreak for 3rd set if super tiebreak is enabled
    if (shouldStartSupertiebreak() && currentSet === 2 && !isTiebreak && !isMatchFinished) {
      setIsTiebreak(true);
      tiebreakPointCountRef.current = 0;
      setGameScore({ adversaire: 0, famille: 0, totalAd: 0 });
    }
  }, [currentSet, isMatchFinished]);


  useEffect(() => {
    currentServerRef.current = currentServer;
  }, [currentServer]);

  useEffect(() => {
    const prev = prevGameScoreRef.current;
    const wasTiebreak = wasTiebreakRef.current;

    if (isTiebreak) {
      const totalPoints = gameScore.adversaire + gameScore.famille;

      if (!wasTiebreak) {
        if (prev.adversaire !== 0 || prev.famille !== 0) {
          // Tiebreak starts at 6-6: the game-score reset arrives in the same
          // render as isTiebreak, so the normal game-end rotation below never
          // ran. Rotate here: the next player in the order serves TB point 1.
          setCurrentServer(prevServer => {
            const first = prevServer === 'famille' ? 'adversaire' : 'famille';
            tiebreakFirstServerRef.current = first;
            return first;
          });
        } else {
          // Score was already 0-0 (super tiebreak entry, or state restored
          // mid-tiebreak): derive the TB's first server from how many serve
          // changes have occurred (after point 1, then every 2 points).
          const serveChanges = Math.ceil(totalPoints / 2);
          tiebreakFirstServerRef.current = serveChanges % 2 === 0
            ? currentServerRef.current
            : (currentServerRef.current === 'famille' ? 'adversaire' : 'famille');
        }
      } else if (totalPoints > tiebreakPointCountRef.current && totalPoints % 2 === 1) {
        // Serve alternates after the 1st point, then every 2 points
        setCurrentServer(prevServer => prevServer === 'famille' ? 'adversaire' : 'famille');
      }
      tiebreakPointCountRef.current = totalPoints;
    } else {
      if (wasTiebreak) {
        // Set decided by a tiebreak: whoever served first in the tiebreak
        // receives first in the next set, so the other player serves.
        const first = tiebreakFirstServerRef.current;
        if (first) {
          setCurrentServer(first === 'famille' ? 'adversaire' : 'famille');
        }
        tiebreakFirstServerRef.current = null;
      } else if (gameScore.adversaire === 0 && gameScore.famille === 0 &&
          (prev.adversaire !== 0 || prev.famille !== 0)) {
        setCurrentServer(prevServer => prevServer === 'famille' ? 'adversaire' : 'famille');
      }
      tiebreakPointCountRef.current = 0;
    }

    wasTiebreakRef.current = isTiebreak;
    prevGameScoreRef.current = { ...gameScore };
  }, [gameScore, isTiebreak]);


  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Shot names are stored/matched internally as fixed English identifiers
  // (see SKILL_KEYS); only the displayed label should follow the language
  // setting, so this only formats the "skill: action" history string for
  // display, leaving the underlying stored value untouched.
  const translateSkillLabel = (skill: string) => t(`matches.radar.axis.${skill}`);

  const formatToggleValueDisplay = (toggleValue: string) => {
    const separatorIndex = toggleValue.indexOf(': ');
    if (separatorIndex === -1) return toggleValue;
    const skill = toggleValue.slice(0, separatorIndex);
    if (!SKILL_KEYS.includes(skill)) return toggleValue;
    const action = toggleValue.slice(separatorIndex + 2);
    return `${translateSkillLabel(skill)}: ${action}`;
  };

  // Live winner/loss percentage per skill row, computed from the point
  // history so far this match - drives the gauge bars next to each Gagne
  // button (win % on top, fault % below, in red).
  const { liveSkillWinPct, liveSkillLossPct } = useMemo(() => {
    const counts: Record<string, { winners: number; total: number }> = {};
    SKILL_KEYS.forEach(skill => { counts[skill] = { winners: 0, total: 0 }; });

    scoringHistory.forEach((entry: any) => {
      if (!entry.toggleValue) return;
      const [skill, action] = entry.toggleValue.split(': ');
      if (!counts[skill]) return;
      counts[skill].total += 1;
      if (action === 'Gagne') counts[skill].winners += 1;
    });

    const winPct: Record<string, number> = {};
    const lossPct: Record<string, number> = {};
    SKILL_KEYS.forEach(skill => {
      const { winners, total } = counts[skill];
      winPct[skill] = total > 0 ? Math.round((winners / total) * 100) : 0;
      lossPct[skill] = total > 0 ? Math.round(((total - winners) / total) * 100) : 0;
    });
    return { liveSkillWinPct: winPct, liveSkillLossPct: lossPct };
  }, [scoringHistory]);

  const resetMatch = () => {
    setSelectedPlayer('');
    setGameScore({ adversaire: 0, famille: 0 });
    setSetScores({ adversaire: [0, 0, 0], famille: [0, 0, 0] });
    setCurrentSet(0);
    setIsTiebreak(false);
    setIsMatchFinished(false);
    setScoreHistory([]);
    setHistoryIndex(-1);
    setTiebreakScores({});
    setHighlightedRow({ row: null, color: null });
    setPressedButton({ skill: null, type: null });
    setScoringHistory([]);
    setShowSetupModal(true);
    setLiveMatchId(null);
    setIsSharing(false);
    setShareUrl('');
    setTotalAdInGame(0);
    sequenceNumberRef.current = 0;
    pointStartTimeRef.current = null;
    prevGameScoreRef.current = { adversaire: 0, famille: 0 };
    tiebreakPointCountRef.current = 0;
    wasTiebreakRef.current = false;
    tiebreakFirstServerRef.current = null;
    setMatchStartTime(null);
    setElapsedTime(0);
    setShowRestorePrompt(false);
    setRetirementPlayer(null);
    setShowRetirementPrompt(false);
    stopCamera();
    clearMatchState();
  };

  const enumerateCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);

      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }

      return videoDevices;
    } catch (error) {
      console.error('Error enumerating cameras:', error);
      return [];
    }
  };

  const startCamera = async (cameraId?: string) => {
    if (!isOpen || showSetupModal || isClosingRef.current) {
      console.log('Not starting camera - modal is closed, in setup, or closing');
      return;
    }

    if (streamRef.current) {
      stopCamera();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      let stream: MediaStream;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      const qualityWidth = videoQuality === 'HD' ? 1280 : 640;
      const qualityHeight = videoQuality === 'HD' ? 720 : 480;

      const getConstraints = (includeAudio: boolean): MediaStreamConstraints => {
        // Request 44.1kHz as the ideal capture rate so it lines up with the
        // AAC encoding target used when recording points (best-effort: the
        // browser/hardware may still deliver a different native rate).
        const audioConstraints: MediaTrackConstraints | false = includeAudio
          ? { sampleRate: { ideal: 44100 } }
          : false;

        if (cameraId) {
          return {
            video: {
              deviceId: { exact: cameraId },
              width: { ideal: qualityWidth },
              height: { ideal: qualityHeight }
            },
            audio: audioConstraints
          };
        } else {
          return {
            video: isMobile ? {
              facingMode: { ideal: 'environment' },
              width: { ideal: qualityWidth },
              height: { ideal: qualityHeight }
            } : {
              width: { ideal: qualityWidth },
              height: { ideal: qualityHeight }
            },
            audio: audioConstraints
          };
        }
      };

      try {
        stream = await navigator.mediaDevices.getUserMedia(getConstraints(true));
      } catch (audioError: any) {
        console.warn('Failed to get audio, trying video only:', audioError);
        stream = await navigator.mediaDevices.getUserMedia(getConstraints(false));
      }

      console.log('Stream obtained:', stream);
      console.log('Video tracks:', stream.getVideoTracks());

      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      console.log('Video track settings:', settings);

      if (settings.deviceId) {
        setSelectedCameraId(settings.deviceId);
      }

      await enumerateCameras();

      setShowCameraSelector(false);

      if (videoRef.current) {
        console.log('Setting srcObject to video element');
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          console.log('Video playing successfully');
          setIsCameraActive(true);
        } catch (playError) {
          console.error('Video autoplay issue:', playError);
          setIsCameraActive(true);
        }
      } else {
        console.error('Video ref is null!');
        setIsCameraActive(true);
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      setIsCameraActive(true);

      let errorMessage = 'Impossible d\'accéder à la caméra.';

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Permission refusée. Veuillez autoriser l\'accès à la caméra dans les paramètres de votre navigateur.\n\nSur Chrome Android:\n1. Appuyez sur le cadenas/icône à gauche de l\'URL\n2. Autorisez l\'accès à la caméra';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'Aucune caméra détectée sur cet appareil.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'La caméra est déjà utilisée par une autre application. Fermez les autres applications utilisant la caméra.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Impossible de satisfaire les contraintes de la caméra. Essayez avec une autre caméra.';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'L\'accès à la caméra est bloqué pour des raisons de sécurité. Assurez-vous d\'utiliser HTTPS.';
      }

      alert(errorMessage);
    }
  };

  const switchCamera = async (newCameraId: string) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    await startCamera(newCameraId);
  };

  const startRecordingPoint = () => {
    if (!streamRef.current) return;

    if (!canRecordLivePoint) {
      showAlert(t('matches.premium.livePointsLimitReached'), { type: 'warning' });
      return;
    }
    incrementUsage('live_point');

    recordingStartTimeRef.current = Date.now();
    pointStartTimeRef.current = Date.now();
    chunksRef.current = [];

    const options: MediaRecorderOptions = {
      videoBitsPerSecond: 2500000,
      // 64kbps AAC-LC @ 44.1kHz (see audio constraint above); MediaRecorder
      // has no explicit codec/sample-rate knob, so this bitrate target is
      // the lever available once mp4/aac (or the webm fallback) is chosen.
      audioBitsPerSecond: 64000,
    };

    // Prefer AAC/H264 in an MP4 container; fall back to the VP8/VP9/Opus
    // WebM path only on devices/browsers that can't record MP4 at all.
    const mp4MimeTypes = [
      'video/mp4;codecs="avc1.42E01E, mp4a.40.2"',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=h264,aac',
      'video/mp4',
    ];
    const webmMimeTypes = [
      'video/webm;codecs=h264',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];

    for (const mimeType of [...mp4MimeTypes, ...webmMimeTypes]) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        options.mimeType = mimeType;
        break;
      }
    }

    const mediaRecorder = new MediaRecorder(streamRef.current, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // mediaRecorder.mimeType reflects what the browser actually recorded
      // with, which may differ from the requested options.mimeType.
      const containerType = (mediaRecorder.mimeType || '').includes('mp4') ? 'video/mp4' : 'video/webm';
      const blob = new Blob(chunksRef.current, { type: containerType });
      setIsRecording(false);

      const duration = recordingStartTimeRef.current
        ? ((Date.now() - recordingStartTimeRef.current) / 1000).toFixed(1)
        : null;

      const pendingAction = pendingActionRef.current;

      if (pendingAction) {
        sequenceNumberRef.current += 1;
        const player = pendingAction.isWin
          ? (pendingAction.skill === 'opponent' ? 'adversaire' : 'famille')
          : (pendingAction.skill === 'opponent' ? 'famille' : 'adversaire');

        const actionText = pendingAction.isWin ? 'Gagne' : 'Faute';

        // Detect special points against the score as it stood going into this
        // point - the same score stored on this entry (gameScore/setScores
        // below). Evaluating against the score that results AFTER this point
        // (as before) attached the wrong point's flags to this entry: e.g. a
        // point played at 0-30 would get flagged as a break point because
        // the *next* point (at 0-40) would be one, while the point that
        // actually reached 0-40 lost the flag since a game-ending point's
        // "next" score resets to 0-0 for the following game.
        const hasGamePoint = isGamePoint(gameScore);
        const hasBreakPoint = isBreakPoint(gameScore);
        const familleSetPoint = isSetPoint(gameScore, setScores, 'famille');
        const adversaireSetPoint = isSetPoint(gameScore, setScores, 'adversaire');
        const familleMatchPoint = isMatchPoint(gameScore, setScores, 'famille');
        const adversaireMatchPoint = isMatchPoint(gameScore, setScores, 'adversaire');

        const newEntry = {
          player: player,
          toggleValue: `${pendingAction.skill}: ${actionText}`,
          timestamp: new Date().toISOString(),
          timestampMs: Date.now(),
          sequence: sequenceNumberRef.current,
          setScores: { adversaire: [...setScores.adversaire], famille: [...setScores.famille] },
          gameScore: { ...gameScore },
          currentSet,
          videoUrl: null,
          duration: duration,
          sizeBytes: blob.size,
          uploading: true,
          isTiebreak: isTiebreak,
          server: currentServer,
          isGamePoint: hasGamePoint,
          isBreakPoint: hasBreakPoint,
          isSetPoint: familleSetPoint || adversaireSetPoint,
          isMatchPoint: familleMatchPoint || adversaireMatchPoint,
        };

        setScoringHistory(prev => [...prev, newEntry]);

        const entrySequence = sequenceNumberRef.current;
        setUploadingEntries(prev => new Set(prev).add(entrySequence));

        // The point is scored right away - the video upload happens in the
        // background below and never delays the scoreboard.
        await scorePoint(player, true);

        pendingActionRef.current = null;
        pointStartTimeRef.current = Date.now();

        uploadVideoToS3Bucket(blob, entrySequence).then((videoUrl) => {
          const storedUrl = videoUrl ? toFinalVideoUrl(videoUrl) : null;

          setUploadingEntries(prev => {
            const newSet = new Set(prev);
            newSet.delete(entrySequence);
            return newSet;
          });

          setScoringHistory(prev => {
            const updated = [...prev];
            const index = updated.findIndex(e => e.sequence === entrySequence);
            if (index !== -1) {
              updated[index] = { ...updated[index], videoUrl: storedUrl, uploading: false };
            }
            return updated;
          });
        });
      } else {
        const lastEntrySequence = sequenceNumberRef.current;
        setUploadingEntries(prev => new Set(prev).add(lastEntrySequence));

        uploadVideoToS3Bucket(blob, lastEntrySequence).then((videoUrl) => {
          const storedUrl = videoUrl ? toFinalVideoUrl(videoUrl) : null;

          setUploadingEntries(prev => {
            const newSet = new Set(prev);
            newSet.delete(lastEntrySequence);
            return newSet;
          });

          if (storedUrl || duration) {
            setScoringHistory(prev => {
              const updated = [...prev];
              const index = updated.findIndex(e => e.sequence === lastEntrySequence);
              if (index !== -1) {
                updated[index] = {
                  ...updated[index],
                  videoUrl: storedUrl || updated[index].videoUrl,
                  duration: duration || updated[index].duration,
                  sizeBytes: blob.size || updated[index].sizeBytes,
                  uploading: false,
                };
              }
              return updated;
            });
          }
        });
      }

      chunksRef.current = [];
      recordingStartTimeRef.current = null;
    };

    mediaRecorder.start(1000);
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
  };

  const stopCurrentPointRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const UPLOAD_RETRY_DELAYS_MS = [1000, 3000];

  /**
   * Retries a couple of times on transient/poor-network failures before
   * giving up. Runs in the background relative to scoring - the point is
   * already on the board by the time this settles, so a slow or flaky
   * connection delays a video clip, never the live score.
   */
  const uploadVideoToS3Bucket = async (videoBlob: Blob, pointSequence: number): Promise<string | null> => {
    if (!liveMatchId) return null;

    const extension = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const maxAttempts = UPLOAD_RETRY_DELAYS_MS.length + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const filename = `${liveMatchId}/point-${pointSequence}-${Date.now()}.${extension}`;
      const result = await uploadVideoToS3(videoBlob, filename);

      if (result) {
        networkWarningShownRef.current = false;
        return result.presignedUrl;
      }

      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, UPLOAD_RETRY_DELAYS_MS[attempt]));
      }
    }

    console.error(`Error uploading video to S3 for point #${pointSequence} after ${maxAttempts} attempts`);

    if (!networkWarningShownRef.current) {
      networkWarningShownRef.current = true;
      showAlert(
        'Votre connexion réseau semble instable, ce qui affecte l\'envoi des vidéos de points. Le score du match n\'est pas impacté, mais certaines vidéos n\'ont pas pu être envoyées.',
        { type: 'warning', title: 'Connexion réseau instable' }
      );
    }

    return null;
  };

  const stopCamera = () => {
    console.log('Stopping camera...');

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    } catch (err) {
      console.error('Error stopping media recorder:', err);
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log('Stopping track:', track.kind, track.label);
          track.stop();
        });
        streamRef.current = null;
      }
    } catch (err) {
      console.error('Error stopping stream tracks:', err);
    }

    try {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    } catch (err) {
      console.error('Error clearing video element:', err);
    }

    setIsRecording(false);
    setIsCameraActive(false);
    setCurrentVideoUrl('');
    console.log('Camera stopped successfully');
  };

  const saveScoreState = () => {
    const newState = {
      gameScore: { ...gameScore },
      setScores: { adversaire: [...setScores.adversaire], famille: [...setScores.famille] },
      currentSet,
      isTiebreak,
      tiebreakScores: { ...tiebreakScores },
      currentServer,
    };
    setScoreHistory(prev => [...prev.slice(0, historyIndex + 1), newState]);
    setHistoryIndex(prev => prev + 1);
  };

  const undoScore = () => {
    if (historyIndex >= 0) {
      const prevState = scoreHistory[historyIndex];
      setGameScore(prevState.gameScore);
      setSetScores(prevState.setScores);
      setCurrentSet(prevState.currentSet);
      setIsTiebreak(prevState.isTiebreak);
      setTiebreakScores(prevState.tiebreakScores);
      if (prevState.currentServer) {
        setCurrentServer(prevState.currentServer);
      }
      prevGameScoreRef.current = { ...prevState.gameScore };
      wasTiebreakRef.current = prevState.isTiebreak;
      if (prevState.isTiebreak) {
        const totalPoints = prevState.gameScore.adversaire + prevState.gameScore.famille;
        tiebreakPointCountRef.current = totalPoints;
        if (prevState.currentServer) {
          // Rebuild who served first in the tiebreak from the restored server
          // and the number of serve changes (after point 1, then every 2 points)
          const serveChanges = Math.ceil(totalPoints / 2);
          tiebreakFirstServerRef.current = serveChanges % 2 === 0
            ? prevState.currentServer
            : (prevState.currentServer === 'famille' ? 'adversaire' : 'famille');
        }
      } else {
        tiebreakPointCountRef.current = 0;
        tiebreakFirstServerRef.current = null;
      }
      setHistoryIndex(prev => prev - 1);
      if (scoringHistory.length > 0) {
        setScoringHistory(prev => prev.slice(0, -1));
        sequenceNumberRef.current = Math.max(0, sequenceNumberRef.current - 1);
      }
      setIsMatchFinished(false);
    }
  };

  const createLiveMatch = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No user logged in, cannot create live match');
      return null;
    }

    const { data, error } = await supabase
      .from('live_matches')
      .insert({
        user_id: user.id,
        player_name: selectedPlayer,
        game_score: gameScore,
        set_scores: setScores,
        current_set: currentSet,
        is_tiebreak: isTiebreak,
        is_finished: isMatchFinished,
        current_server: currentServer,
        game_format: gameFormat,
        scoring_history: scoringHistory,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating live match:', error);
      return null;
    }

    setLiveMatchId(data.id);
    return data.id;
  };

  const handleShare = async () => {
    if (liveMatchId) {
      const url = `${window.location.origin}/shared-livescore/${liveMatchId}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setIsSharing(true);
      showAlert('Lien copié dans le presse-papiers! Partagez-le pour permettre aux autres de suivre le match en direct.', {
        type: 'success',
        title: 'Match partagé',
        link: url
      });
      return;
    }

    // No live match yet: only one share link should ever be created for
    // this match. Guard with a ref (synchronous, unlike state) so rapid
    // repeated clicks before the first createLiveMatch() resolves can't
    // each create their own live_matches row/URL.
    if (isCreatingShareLinkRef.current) return;
    isCreatingShareLinkRef.current = true;
    setIsCreatingShareLink(true);

    try {
      const newLiveMatchId = await createLiveMatch();

      if (newLiveMatchId) {
        const url = `${window.location.origin}/shared-livescore/${newLiveMatchId}`;
        setShareUrl(url);
        await navigator.clipboard.writeText(url);
        setIsSharing(true);
        showAlert('Lien copié dans le presse-papiers! Partagez-le pour permettre aux autres de suivre le match en direct.', {
          type: 'success',
          title: 'Match partagé',
          link: url
        });
      }
    } finally {
      isCreatingShareLinkRef.current = false;
      setIsCreatingShareLink(false);
    }
  };

  const updateLiveMatch = async () => {
    if (!liveMatchId) return;

    await supabase
      .from('live_matches')
      .update({
        game_score: gameScore,
        set_scores: setScores,
        current_set: currentSet,
        is_tiebreak: isTiebreak,
        is_finished: isMatchFinished,
        current_server: currentServer,
        scoring_history: scoringHistory,
        retirement_player: retirementPlayer,
        updated_at: new Date().toISOString(),
      })
      .eq('id', liveMatchId);
  };

  const shouldTriggerTiebreak = (playerGames: number, opponentGames: number) => {
    if (gameFormat.tiebreakAt > 0) {
      return playerGames === gameFormat.tiebreakAt && opponentGames === gameFormat.tiebreakAt;
    }
    if (gameFormat.threeGames) return playerGames === 2 && opponentGames === 2;
    if (gameFormat.fourGames) return playerGames === 3 && opponentGames === 3;
    if (gameFormat.fiveGames) return playerGames === 4 && opponentGames === 4;
    if (gameFormat.sixGames) return playerGames === 6 && opponentGames === 6;
    return playerGames === 6 && opponentGames === 6;
  };

  const isSetWon = (playerGames: number, opponentGames: number) => {
    if (gameFormat.tiebreakAt > 0 && playerGames === gameFormat.tiebreakAt + 1 && opponentGames === gameFormat.tiebreakAt) {
      return true;
    }
    if (gameFormat.threeGames) return playerGames >= 3 && playerGames - opponentGames >= 2;
    if (gameFormat.fourGames) return playerGames >= 4 && playerGames - opponentGames >= 2;
    if (gameFormat.fiveGames) return playerGames >= 5 && playerGames - opponentGames >= 2;
    if (gameFormat.sixGames) return playerGames >= 6 && playerGames - opponentGames >= 2;
    return playerGames >= 6 && playerGames - opponentGames >= 2;
  };

  const shouldStartSupertiebreak = () => {
    if (!gameFormat.supertiebreak) return false;

    // Count completed sets only
    let adversaireSets = 0;
    let familleSets = 0;
    for (let i = 0; i < 3; i++) {
      if (isSetWon(setScores.adversaire[i], setScores.famille[i])) adversaireSets++;
      if (isSetWon(setScores.famille[i], setScores.adversaire[i])) familleSets++;
    }

    return adversaireSets === 1 && familleSets === 1;
  };

  const checkMatchFinished = (newSetScores: SetScores) => {
    // Count completed sets only
    let adversaireSets = 0;
    let familleSets = 0;
    for (let i = 0; i < 3; i++) {
      if (isSetWon(newSetScores.adversaire[i], newSetScores.famille[i])) adversaireSets++;
      if (isSetWon(newSetScores.famille[i], newSetScores.adversaire[i])) familleSets++;
    }

    if (adversaireSets >= 2 || familleSets >= 2) {
      setIsMatchFinished(true);
      return true;
    }
    return false;
  };

  // Check if this point will win a game
  const willWinGame = (currentGameScore: GameScore, scoringPlayer: 'adversaire' | 'famille'): boolean => {
    const opponent = scoringPlayer === 'adversaire' ? 'famille' : 'adversaire';

    if (isTiebreak) {
      const newScore = currentGameScore[scoringPlayer] + 1;
      const opponentScore = currentGameScore[opponent];
      const isSupertiebreak = shouldStartSupertiebreak() && currentSet === 2;
      return isSupertiebreak
        ? newScore >= 10 && (newScore - opponentScore) >= 2
        : newScore >= 7 && (newScore - opponentScore) >= 2;
    } else {
      // No-ad scoring: 40-40, next point wins
      if (gameFormat.noAd && currentGameScore[scoringPlayer] === 3 && currentGameScore[opponent] === 3) {
        return true;
      }
      // Regular scoring: 40-anything except deuce/AD, or AD-40
      if (currentGameScore[scoringPlayer] === 3 && currentGameScore[opponent] < 3) return true;
      if (currentGameScore[scoringPlayer] === 4 && currentGameScore[opponent] === 3) return true;
      return false;
    }
  };

  // Detect if this is a game point (for the server)
  const isGamePoint = (currentGameScore: GameScore): boolean => {
    if (currentServer === 'famille') {
      return willWinGame(currentGameScore, 'famille');
    } else {
      return willWinGame(currentGameScore, 'adversaire');
    }
  };

  // Detect if this is a break point (for the receiver)
  const isBreakPoint = (currentGameScore: GameScore): boolean => {
    if (currentServer === 'famille') {
      return willWinGame(currentGameScore, 'adversaire');
    } else {
      return willWinGame(currentGameScore, 'famille');
    }
  };

  // Detect if this is a set point
  const isSetPoint = (currentGameScore: GameScore, currentSetScores: SetScores, potentialWinner: 'adversaire' | 'famille'): boolean => {
    const opponent = potentialWinner === 'adversaire' ? 'famille' : 'adversaire';
    const playerGames = currentSetScores[potentialWinner][currentSet];
    const opponentGames = currentSetScores[opponent][currentSet];

    if (!willWinGame(currentGameScore, potentialWinner)) return false;

    // After winning this game, will we have won the set?
    const gamesAfter = playerGames + 1;

    if (isTiebreak) {
      // In a tiebreak, winning the tiebreak wins the set
      return true;
    }

    return isSetWon(gamesAfter, opponentGames);
  };

  // Detect if this is a match point
  const isMatchPoint = (currentGameScore: GameScore, currentSetScores: SetScores, potentialWinner: 'adversaire' | 'famille'): boolean => {
    if (!isSetPoint(currentGameScore, currentSetScores, potentialWinner)) return false;

    const opponent = potentialWinner === 'famille' ? 'adversaire' : 'famille';

    // Count how many sets each player has already WON (completed sets only)
    let setsWon = 0;
    for (let i = 0; i < 3; i++) {
      const playerGames = currentSetScores[potentialWinner][i];
      const opponentGames = currentSetScores[opponent][i];

      // A set is won if the player has enough games with proper margin
      if (isSetWon(playerGames, opponentGames)) {
        setsWon++;
      }
    }

    // Match point occurs when a player has already won 1 set and is about to win their 2nd set
    // In a best-of-3 match format, winning 2 sets means winning the match
    // Note: If a player has already won 2 sets, the match is already over
    return setsWon === 1;
  };

  const scorePoint = async (player: 'adversaire' | 'famille', fromSkill: boolean = false) => {
    let videoUrl = null;

    if (isRecording) {
      await stopCurrentPointRecording();
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    if (!fromSkill) {
      const duration = pointStartTimeRef.current
        ? ((Date.now() - pointStartTimeRef.current) / 1000).toFixed(1)
        : null;

      // Detect special points against the score as it stood going into this
      // point - the same score stored on this entry (gameScore/setScores
      // below), not the score that results after it (see the sibling branch
      // above for why that was wrong).
      const hasGamePoint = isGamePoint(gameScore);
      const hasBreakPoint = isBreakPoint(gameScore);
      const familleSetPoint = isSetPoint(gameScore, setScores, 'famille');
      const adversaireSetPoint = isSetPoint(gameScore, setScores, 'adversaire');
      const familleMatchPoint = isMatchPoint(gameScore, setScores, 'famille');
      const adversaireMatchPoint = isMatchPoint(gameScore, setScores, 'adversaire');

      sequenceNumberRef.current += 1;
      const newEntry = {
        player: player,
        toggleValue: `Score direct`,
        timestamp: new Date().toISOString(),
        timestampMs: Date.now(),
        sequence: sequenceNumberRef.current,
        setScores: { adversaire: [...setScores.adversaire], famille: [...setScores.famille] },
        gameScore: { ...gameScore },
        currentSet,
        videoUrl: videoUrl,
        duration: duration,
        isTiebreak: isTiebreak,
        server: currentServer,
        isGamePoint: hasGamePoint,
        isBreakPoint: hasBreakPoint,
        isSetPoint: familleSetPoint || adversaireSetPoint,
        isMatchPoint: familleMatchPoint || adversaireMatchPoint,
      };
      setScoringHistory(prev => [...prev, newEntry]);
      pointStartTimeRef.current = Date.now();
    }

    if (isRecording && !isMatchFinished) {
      startRecordingPoint();
    }

    setGameScore(prev => {
      const newScore = { ...prev };
      const opponent = player === 'adversaire' ? 'famille' : 'adversaire';

      if (isTiebreak) {
        newScore[player] = prev[player] + 1;
        const playerScore = newScore[player];
        const opponentScore = newScore[opponent];

        const tiebreakWon = shouldStartSupertiebreak() && currentSet === 2
          ? playerScore >= 10 && (playerScore - opponentScore) >= 2
          : playerScore >= 7 && (playerScore - opponentScore) >= 2;

        if (tiebreakWon) {
          setTiebreakScores(prev => ({ ...prev, [currentSet]: { adversaire: newScore.adversaire, famille: newScore.famille } }));

          setSetScores(prevSets => {
            const newSets = { ...prevSets };
            if (shouldStartSupertiebreak() && currentSet === 2) {
              newSets[player][currentSet] = newScore[player];
              newSets[opponent][currentSet] = newScore[opponent];
            } else if (gameFormat.tiebreakAt > 0) {
              newSets[player][currentSet] = gameFormat.tiebreakAt + 1;
              newSets[opponent][currentSet] = gameFormat.tiebreakAt;
            } else if (gameFormat.threeGames) {
              newSets[player][currentSet] = 3;
              newSets[opponent][currentSet] = 2;
            } else if (gameFormat.fourGames) {
              newSets[player][currentSet] = 4;
              newSets[opponent][currentSet] = 3;
            } else if (gameFormat.fiveGames) {
              newSets[player][currentSet] = 5;
              newSets[opponent][currentSet] = 4;
            } else {
              newSets[player][currentSet] = 7;
              newSets[opponent][currentSet] = 6;
            }
            checkMatchFinished(newSets);
            return newSets;
          });
          setCurrentSet(prev => prev + 1);
          setIsTiebreak(false);
          return { adversaire: 0, famille: 0, totalAd: 0 };
        }
      } else {
        if (prev[player] === 3 && prev[opponent] === 3) {
          if (gameFormat.noAd) {
            setSetScores(prevSets => {
              const newSets = { ...prevSets };
              newSets[player][currentSet] = newSets[player][currentSet] + 1;
              const playerGames = newSets[player][currentSet];
              const opponentGames = newSets[opponent][currentSet];

              if (isSetWon(playerGames, opponentGames)) {
                setCurrentSet(prev => prev + 1);
                checkMatchFinished(newSets);
              } else if (shouldTriggerTiebreak(playerGames, opponentGames)) {
                setIsTiebreak(true);
              }
              return newSets;
            });
            return { adversaire: 0, famille: 0, totalAd: 0 };
          } else {
            newScore[player] = 4;
            // Don't increment when leaving 3-3 to go to AD
            newScore.totalAd = prev.totalAd || 0;
          }
        } else if (prev[player] === 3 && prev[opponent] === 4) {
          newScore[player] = 3;
          newScore[opponent] = 3;
          // Increment when REACHING 3-3 (back to deuce from AD)
          newScore.totalAd = (prev.totalAd || 0) + 1;
        } else if (prev[player] === 4 && prev[opponent] === 3) {
          setSetScores(prevSets => {
            const newSets = { ...prevSets };
            newSets[player][currentSet] = newSets[player][currentSet] + 1;
            const playerGames = newSets[player][currentSet];
            const opponentGames = newSets[opponent][currentSet];

            if (isSetWon(playerGames, opponentGames)) {
              setCurrentSet(prev => prev + 1);
              checkMatchFinished(newSets);
            } else if (shouldTriggerTiebreak(playerGames, opponentGames)) {
              setIsTiebreak(true);
            }
            return newSets;
          });
          return { adversaire: 0, famille: 0, totalAd: 0 };
        } else if (prev[player] === 3 && prev[opponent] < 3) {
          setSetScores(prevSets => {
            const newSets = { ...prevSets };
            newSets[player][currentSet] = newSets[player][currentSet] + 1;
            const playerGames = newSets[player][currentSet];
            const opponentGames = newSets[opponent][currentSet];

            if (isSetWon(playerGames, opponentGames)) {
              setCurrentSet(prev => prev + 1);
              checkMatchFinished(newSets);
            } else if (shouldTriggerTiebreak(playerGames, opponentGames)) {
              setIsTiebreak(true);
            }
            return newSets;
          });
          return { adversaire: 0, famille: 0, totalAd: 0 };
        } else {
          newScore[player] = prev[player] + 1;
          // Check if this point brings us to 3-3 for the first time (deuce)
          if (newScore[player] === 3 && newScore[opponent] === 3) {
            newScore.totalAd = (prev.totalAd || 0) + 1;
          } else {
            newScore.totalAd = prev.totalAd || 0;
          }
        }
      }

      return newScore;
    });

    saveScoreState();
  };

  const setWon = async (skill: string) => {
    if (pressedButton.skill || isMatchFinished) return;
    setPressedButton({ skill, type: 'won' });
    setHighlightedRow({ row: skill, color: 'green' });

    setTimeout(() => {
      setHighlightedRow({ row: null, color: null });
      setPressedButton({ skill: null, type: null });
    }, 1000);

    if (isRecording) {
      pendingActionRef.current = { skill, isWin: true };
      await stopCurrentPointRecording();
    } else {
      const player = skill === 'opponent' ? 'adversaire' : 'famille';

      const duration = pointStartTimeRef.current
        ? ((Date.now() - pointStartTimeRef.current) / 1000).toFixed(1)
        : null;

      // Detect special points against the score as it stood going into this
      // point - the same score stored on this entry (gameScore/setScores
      // below), not the score that results after it (see the sibling branch
      // above for why that was wrong).
      const hasGamePoint = isGamePoint(gameScore);
      const hasBreakPoint = isBreakPoint(gameScore);
      const familleSetPoint = isSetPoint(gameScore, setScores, 'famille');
      const adversaireSetPoint = isSetPoint(gameScore, setScores, 'adversaire');
      const familleMatchPoint = isMatchPoint(gameScore, setScores, 'famille');
      const adversaireMatchPoint = isMatchPoint(gameScore, setScores, 'adversaire');

      sequenceNumberRef.current += 1;
      const newEntry = {
        player: player,
        toggleValue: `${skill}: Gagne`,
        timestamp: new Date().toISOString(),
        timestampMs: Date.now(),
        sequence: sequenceNumberRef.current,
        setScores: { adversaire: [...setScores.adversaire], famille: [...setScores.famille] },
        gameScore: { ...gameScore },
        currentSet,
        videoUrl: null,
        duration: duration,
        isTiebreak: isTiebreak,
        server: currentServer,
        isGamePoint: hasGamePoint,
        isBreakPoint: hasBreakPoint,
        isSetPoint: familleSetPoint || adversaireSetPoint,
        isMatchPoint: familleMatchPoint || adversaireMatchPoint,
      };
      setScoringHistory(prev => [...prev, newEntry]);

      pointStartTimeRef.current = Date.now();

      await scorePoint(player, true);
    }
  };

  const setFault = async (skill: string) => {
    if (pressedButton.skill || isMatchFinished) return;
    setPressedButton({ skill, type: 'fault' });
    setHighlightedRow({ row: skill, color: 'red' });

    setTimeout(() => {
      setHighlightedRow({ row: null, color: null });
      setPressedButton({ skill: null, type: null });
    }, 1000);

    if (isRecording) {
      pendingActionRef.current = { skill, isWin: false };
      await stopCurrentPointRecording();
    } else {
      const player = skill === 'opponent' ? 'famille' : 'adversaire';

      const duration = pointStartTimeRef.current
        ? ((Date.now() - pointStartTimeRef.current) / 1000).toFixed(1)
        : null;

      // Detect special points against the score as it stood going into this
      // point - the same score stored on this entry (gameScore/setScores
      // below), not the score that results after it (see the sibling branch
      // above for why that was wrong).
      const hasGamePoint = isGamePoint(gameScore);
      const hasBreakPoint = isBreakPoint(gameScore);
      const familleSetPoint = isSetPoint(gameScore, setScores, 'famille');
      const adversaireSetPoint = isSetPoint(gameScore, setScores, 'adversaire');
      const familleMatchPoint = isMatchPoint(gameScore, setScores, 'famille');
      const adversaireMatchPoint = isMatchPoint(gameScore, setScores, 'adversaire');

      sequenceNumberRef.current += 1;
      const newEntry = {
        player: player,
        toggleValue: `${skill}: Faute`,
        timestamp: new Date().toISOString(),
        timestampMs: Date.now(),
        sequence: sequenceNumberRef.current,
        setScores: { adversaire: [...setScores.adversaire], famille: [...setScores.famille] },
        gameScore: { ...gameScore },
        currentSet,
        videoUrl: null,
        duration: duration,
        isTiebreak: isTiebreak,
        server: currentServer,
        isGamePoint: hasGamePoint,
        isBreakPoint: hasBreakPoint,
        isSetPoint: familleSetPoint || adversaireSetPoint,
        isMatchPoint: familleMatchPoint || adversaireMatchPoint,
      };
      setScoringHistory(prev => [...prev, newEntry]);

      pointStartTimeRef.current = Date.now();

      await scorePoint(player, true);
    }
  };

  const tennisScores = ['0', '15', '30', '40'];

  const getDisplayScore = (score: number) => {
    if (isTiebreak) return score.toString();
    if (score >= 4) return 'AD';
    if (score >= 0 && score <= 3) return tennisScores[score];
    return '0';
  };

  const generateScoreString = () => {
    const scoreParts = [];
    for (let i = 0; i < 3; i++) {
      const familleScore = setScores.famille[i];
      const adversaireScore = setScores.adversaire[i];

      if (familleScore > 0 || adversaireScore > 0) {
        // For third set with supertiebreak format, only show (X/Y)
        if (i === 2 && gameFormat.supertiebreak) {
          scoreParts.push(`(${familleScore}/${adversaireScore})`);
        } else if (tiebreakScores[i]) {
          const tb = tiebreakScores[i];
          scoreParts.push(`${familleScore}/${adversaireScore} (${tb.famille}/${tb.adversaire})`);
        } else {
          scoreParts.push(`${familleScore}/${adversaireScore}`);
        }
      }
    }
    return scoreParts.join(' - ');
  };

  const analyzeSkills = () => {
    const skillStats: any = {
      forehand: { good: 0, bad: 0 },
      backhand: { good: 0, bad: 0 },
      serve: { good: 0, bad: 0 },
      return: { good: 0, bad: 0 }
    };

    scoringHistory.forEach((entry: any) => {
      if (entry.toggleValue) {
        const [skill, action] = entry.toggleValue.split(': ');
        if (skillStats[skill]) {
          if (action === 'Gagne') skillStats[skill].good++;
          else if (action === 'Faute') skillStats[skill].bad++;
        }
      }
    });

    const getSkillAnalysis = (skill: string) => {
      const stats = skillStats[skill];
      if (stats.good > stats.bad) return 'great';
      if (stats.good === stats.bad) return 'good';
      return 'bad';
    };

    return {
      forehand: getSkillAnalysis('forehand'),
      backhand: getSkillAnalysis('backhand'),
      serve: getSkillAnalysis('serve'),
      return: getSkillAnalysis('return')
    };
  };

  const handleFinishMatch = () => {
    if (!isMatchFinished) {
      // Ending before either player has actually won a match point is only
      // ever a retirement/abandon - the prompt below both confirms that's
      // really what's happening and records who retired, so the shared live
      // page and the saved match can say who actually won.
      setShowRetirementPrompt(true);
      return;
    }
    finishMatch();
  };

  const confirmRetirement = (retired: 'adversaire' | 'famille') => {
    setShowRetirementPrompt(false);
    setRetirementPlayer(retired);
    setIsMatchFinished(true);
    // React batches these, but finishMatch reads retirementPlayer/isMatchFinished
    // synchronously right after - pass the value directly rather than relying
    // on state that hasn't re-rendered yet.
    finishMatch(retired);
  };

  const finishMatch = async (retirementOverride?: 'adversaire' | 'famille' | null) => {
    setIsSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Vous devez être connecté pour enregistrer un match');
      setIsSaving(false);
      return;
    }

    const retirement = retirementOverride !== undefined ? retirementOverride : retirementPlayer;
    const score = generateScoreString();
    const skillAnalysis = analyzeSkills();

    const gamePerSet = gameFormat.threeGames ? 3 : gameFormat.fourGames ? 4 : gameFormat.fiveGames ? 5 : gameFormat.sixGames ? 6 : undefined;

    const matchData = {
      date: new Date().toISOString().split('T')[0],
      player_name: selectedPlayer || 'Match Live',
      tournament_name: 'Match Live',
      score,
      classement: 'NC' as const,
      forehand: skillAnalysis.forehand as 'bad' | 'good' | 'great',
      backhand: skillAnalysis.backhand as 'bad' | 'good' | 'great',
      serve: skillAnalysis.serve as 'bad' | 'good' | 'great',
      return: skillAnalysis.return as 'bad' | 'good' | 'great',
      scoring_history: scoringHistory,
      game_per_set: gamePerSet,
      super_tiebreak: gameFormat.supertiebreak,
      no_ad: gameFormat.noAd,
      retirement_player: retirement,
    };

    setIsSaving(false);

    if (onMatchFinished) {
      // The Add Match modal takes over from here; keep this session's state
      // intact (in memory and in localStorage) in case the user cancels
      // there and needs to come back to it. Also leave the history entry
      // pushed when this session opened untouched (raw onClose, not
      // handleClose) - Add Match pushes its own on top, and if the user
      // cancels back into this modal, skipNextHistoryPushRef below avoids
      // double-pushing for what is still the same continuous session.
      skipNextResetRef.current = true;
      skipNextHistoryPushRef.current = true;
      onClose();
      onMatchFinished(matchData);
    } else {
      clearMatchState();
      handleClose();
      resetMatch();
      const { error } = await supabase.from('match_results').insert({
        user_id: user.id,
        ...matchData,
        impressions: {
          forehand: matchData.forehand,
          backhand: matchData.backhand,
          serve: matchData.serve,
          return: matchData.return,
        },
      });

      if (error) {
        console.error('Error saving match:', error);
        alert('Erreur lors de l\'enregistrement du match');
      } else {
        onMatchSaved();
      }
    }
  };

  if (!isOpen) return null;

  if (showRestorePrompt) {
    const savedState = loadMatchState();
    return (
      <>
        <AlertComponent />
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => {
        stopCamera();
        setShowRestorePrompt(false);
        resetMatch();
      }}>
        <div className="bg-gradient-to-br from-[#0a1628] to-[#050d1a] rounded-xl shadow-2xl border border-white/10 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Match en cours détecté</h3>
            <button onClick={() => {
              stopCamera();
              setShowRestorePrompt(false);
              resetMatch();
            }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-300" />
            </button>
          </div>

          <div className="mb-6">
            <p className="text-gray-300 mb-4">
              Nous avons détecté un match qui n'a pas été sauvegardé. Voulez-vous le reprendre où vous l'avez laissé ?
            </p>
            {savedState && (
              <div className="bg-[#C8F135]/10 border border-[#C8F135]/30 rounded-lg p-4 space-y-2">
                <p className="text-sm text-gray-200">
                  <span className="font-semibold text-[#C8F135]">Joueur:</span> {savedState.selectedPlayer || 'Non défini'}
                </p>
                <p className="text-sm text-gray-200">
                  <span className="font-semibold text-[#C8F135]">Score:</span> {savedState.setScores?.famille?.join('-')} / {savedState.setScores?.adversaire?.join('-')}
                </p>
                {savedState.scoringHistory && savedState.scoringHistory.length > 0 && (
                  <p className="text-sm text-gray-200">
                    <span className="font-semibold text-[#C8F135]">Points enregistrés:</span> {savedState.scoringHistory.length}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                if (savedState) {
                  restoreMatchState(savedState);
                  setShowRestorePrompt(false);
                  if (!savedState.showSetupModal) {
                    startCamera();
                  }
                }
              }}
              className="w-full px-4 py-3 bg-[#C8F135] text-[#050d1a] rounded-lg font-bold hover:bg-[#b5d930] transition-colors"
            >
              Reprendre le match
            </button>
            <button
              onClick={() => {
                stopCamera();
                clearMatchState();
                setShowRestorePrompt(false);
                resetMatch();
              }}
              className="w-full px-4 py-3 bg-white/10 text-white border border-white/20 rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              Commencer un nouveau match
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  if (showSetupModal) {
    return (
      <>
        <AlertComponent />
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => {
        isClosingRef.current = true;
        stopCamera();
        saveMatchState();
        handleClose();
        setTimeout(() => {
          isClosingRef.current = false;
        }, 500);
      }}>
        <div className="bg-gradient-to-br from-[#0a1628] to-[#050d1a] rounded-xl shadow-2xl border border-white/10 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Configuration du Match</h3>
            <button onClick={() => {
              isClosingRef.current = true;
              stopCamera();
              saveMatchState();
              handleClose();
              setTimeout(() => {
                isClosingRef.current = false;
              }, 500);
            }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-300" />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <p className="text-sm font-semibold text-gray-300 mb-3">Sélectionner le joueur</p>
              <select
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135]"
                required
              >
                <option value="" className="bg-[#0a1628] text-gray-300">Sélectionner un joueur</option>
                {players.map(player => {
                  const displayName = player.first_name;
                  return (
                    <option key={player.id} value={displayName} className="bg-[#0a1628] text-white">{displayName}</option>
                  );
                })}
              </select>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-300 mb-3">Qui sert en premier ?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCurrentServer('famille')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    currentServer === 'famille'
                      ? 'border-[#C8F135] bg-[#C8F135]/10 shadow-lg shadow-[#C8F135]/20'
                      : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className={`w-4 h-4 ${currentServer === 'famille' ? 'text-[#C8F135]' : 'text-gray-400'}`} />
                    <span className={`font-medium ${currentServer === 'famille' ? 'text-[#C8F135]' : 'text-gray-300'}`}>{selectedPlayer || 'Joueur'}</span>
                  </div>
                </button>
                <button
                  onClick={() => setCurrentServer('adversaire')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    currentServer === 'adversaire'
                      ? 'border-[#C8F135] bg-[#C8F135]/10 shadow-lg shadow-[#C8F135]/20'
                      : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className={`w-4 h-4 ${currentServer === 'adversaire' ? 'text-[#C8F135]' : 'text-gray-400'}`} />
                    <span className={`font-medium ${currentServer === 'adversaire' ? 'text-[#C8F135]' : 'text-gray-300'}`}>Adversaire</span>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-300 mb-3">Format de jeu</p>
              <select
                value={gameFormat.formatPreset}
                onChange={(e) => {
                  const preset = parseInt(e.target.value);
                  switch (preset) {
                    case 1:
                      setGameFormat({ threeGames: false, fourGames: false, fiveGames: false, sixGames: true, supertiebreak: false, noAd: false, tiebreakAt: 6, formatPreset: 1 });
                      break;
                    case 2:
                      setGameFormat({ threeGames: false, fourGames: false, fiveGames: false, sixGames: true, supertiebreak: true, noAd: false, tiebreakAt: 6, formatPreset: 2 });
                      break;
                    case 3:
                      setGameFormat({ threeGames: false, fourGames: true, fiveGames: false, sixGames: false, supertiebreak: true, noAd: true, tiebreakAt: 4, formatPreset: 3 });
                      break;
                    case 4:
                      setGameFormat({ threeGames: false, fourGames: false, fiveGames: false, sixGames: true, supertiebreak: true, noAd: true, tiebreakAt: 6, formatPreset: 4 });
                      break;
                    case 5:
                      setGameFormat({ threeGames: true, fourGames: false, fiveGames: false, sixGames: false, supertiebreak: true, noAd: true, tiebreakAt: 2, formatPreset: 5 });
                      break;
                    case 6:
                      setGameFormat({ threeGames: false, fourGames: true, fiveGames: false, sixGames: false, supertiebreak: true, noAd: true, tiebreakAt: 3, formatPreset: 6 });
                      break;
                    case 7:
                      setGameFormat({ threeGames: false, fourGames: false, fiveGames: true, sixGames: false, supertiebreak: true, noAd: true, tiebreakAt: 4, formatPreset: 7 });
                      break;
                    default:
                      setGameFormat({ threeGames: false, fourGames: false, fiveGames: false, sixGames: true, supertiebreak: true, noAd: false, tiebreakAt: 6, formatPreset: 2 });
                  }
                }}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] text-sm"
              >
                <option value={1} className="bg-[#0a1628] text-white">Format 1 - 3 Sets en 6 jeux (TB 6/6, Ad)</option>
                <option value={2} className="bg-[#0a1628] text-white">Format 2 - 2 Sets en 6 jeux (TB 6/6, Ad) + Super TB</option>
                <option value={3} className="bg-[#0a1628] text-white">Format 3 - 2 Sets en 4 jeux (TB 4/4, No Ad) + Super TB</option>
                <option value={4} className="bg-[#0a1628] text-white">Format 4 - 2 Sets en 6 jeux (TB 6/6, No Ad) + Super TB</option>
                <option value={5} className="bg-[#0a1628] text-white">Format 5 - 2 Sets en 3 jeux (TB 2/2, No Ad) + Super TB</option>
                <option value={6} className="bg-[#0a1628] text-white">Format 6 - 2 Sets en 4 jeux (TB 3/3, No Ad) + Super TB</option>
                <option value={7} className="bg-[#0a1628] text-white">Format 7 - 2 Sets en 5 jeux (TB 4/4, No Ad) + Super TB</option>
              </select>

              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={gameFormat.supertiebreak}
                    onChange={(e) => setGameFormat({ ...gameFormat, supertiebreak: e.target.checked })}
                    className="w-4 h-4 text-[#C8F135] rounded focus:ring-[#C8F135] focus:ring-offset-0 bg-white/5 border-white/20"
                  />
                  <span className="text-sm text-gray-300">Supertiebreak (3ème set)</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={gameFormat.noAd}
                    onChange={(e) => setGameFormat({ ...gameFormat, noAd: e.target.checked })}
                    className="w-4 h-4 text-[#C8F135] rounded focus:ring-[#C8F135] focus:ring-offset-0 bg-white/5 border-white/20"
                  />
                  <span className="text-sm text-gray-300">No Ad</span>
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              setShowSetupModal(false);
              setMatchStartTime(Date.now());
              pointStartTimeRef.current = Date.now();
              await createLiveMatch();
            }}
            disabled={!selectedPlayer}
            className="w-full px-4 py-3 bg-[#C8F135] text-[#050d1a] rounded-lg font-bold hover:bg-[#b5d930] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            Commencer le Match
          </button>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <AlertComponent />
      <LiveScoreHelpTour isOpen={showHelpTour} onClose={() => setShowHelpTour(false)} />
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gradient-to-br from-[#0a1628] to-[#050d1a] rounded-xl shadow-2xl border border-white/10 max-w-2xl w-full h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#0a1628] to-[#0f1e35] border-b border-white/10 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-white">Live Score</h3>
              {matchStartTime && (
                <span className="px-2 py-1 bg-[#C8F135]/20 text-[#C8F135] text-xs font-semibold rounded-full border border-[#C8F135]/30">
                  {formatTime(elapsedTime)}
                </span>
              )}
            </div>
            <button
              onClick={undoScore}
              disabled={historyIndex < 0 || isMatchFinished || isLocked}
              data-tour-id="tour-undo-button"
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-white/10"
            >
              <ArrowLeft className="w-3 h-3" />
              <span className="hidden sm:inline">Annuler</span>
            </button>
            <button
              onClick={handleShare}
              disabled={isCreatingShareLink}
              data-tour-id="tour-share-button"
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-[#C8F135] text-[#050d1a] rounded-lg hover:bg-[#b5d930] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
              title="Partager le match en direct"
            >
              <Share2 className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden sm:inline">{isCreatingShareLink ? '...' : isSharing ? 'Partagé' : 'Partager'}</span>
            </button>
            <button
              onClick={() => setIsLocked(!isLocked)}
              data-tour-id="tour-lock-button"
              className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors border ${
                isLocked
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30'
                  : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/30'
              }`}
              title={isLocked ? 'Déverrouiller le score' : 'Verrouiller le score'}
            >
              {isLocked ? <Lock className="w-3 sm:w-4 h-3 sm:h-4" /> : <Unlock className="w-3 sm:w-4 h-3 sm:h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <LiveScoreHelpButton onClick={() => setShowHelpTour(true)} />
            <button onClick={() => {
              if (!isMatchFinished) {
                saveMatchState();
              }
              isClosingRef.current = true;
              stopCamera();
              handleClose();
              setTimeout(() => {
                isClosingRef.current = false;
              }, 500);
            }} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto">
          {!isMatchFinished && (
            <div className="flex flex-col">
              {!showSetupModal && (
                <div className="bg-black relative w-full aspect-video max-h-[30vh] flex-shrink-0">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${!videoEnabled ? 'invisible' : ''}`}
                    onLoadedMetadata={(e) => {
                      console.log('Video metadata loaded:', e.currentTarget.videoWidth, 'x', e.currentTarget.videoHeight);
                      e.currentTarget.play().catch(err => console.error('Play error:', err));
                    }}
                    onCanPlay={(e) => {
                      console.log('Video can play');
                      e.currentTarget.play().catch(err => console.error('Play error on canplay:', err));
                    }}
                  />

                  {!videoEnabled && (
                    <div className="absolute inset-0 w-full h-full bg-black" />
                  )}

                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <button
                      onClick={() => setVideoEnabled(!videoEnabled)}
                      className="p-2 bg-gray-800/70 text-white rounded-full hover:bg-gray-700/80 transition-colors backdrop-blur-sm"
                      title={videoEnabled ? "Masquer la vidéo" : "Afficher la vidéo"}
                    >
                      {videoEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    {isRecording && (
                      <div className="flex items-center gap-2 bg-red-600/80 px-3 py-1 rounded-full animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                        <span className="text-white text-xs font-bold uppercase">REC</span>
                      </div>
                    )}
                  </div>

                  <div className="absolute top-4 right-4">
                    <button
                      onClick={() => setShowCameraSelector(!showCameraSelector)}
                      className="p-3 bg-gray-800/70 text-white rounded-full hover:bg-gray-700/80 transition-colors backdrop-blur-sm"
                      title="Choisir la caméra"
                    >
                      <Settings className="w-5 h-5" />
                    </button>

                    {showCameraSelector && (
                      <div className="absolute right-0 mt-2 bg-slate-800 rounded shadow-xl border border-slate-700 p-3 min-w-[220px] z-10">
                        <p className="text-sm font-semibold text-slate-300 mb-2">Sélectionner une caméra:</p>
                        <div className="space-y-2 mb-3">
                          {availableCameras.length === 0 && (
                            <button
                              onClick={() => enumerateCameras()}
                              className="text-sm text-blue-400 hover:text-blue-300"
                            >
                              Détecter les caméras
                            </button>
                          )}
                          {availableCameras.map((camera, index) => (
                            <button
                              key={camera.deviceId}
                              onClick={() => {
                                switchCamera(camera.deviceId);
                                setShowCameraSelector(false);
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition-colors ${
                                selectedCameraId === camera.deviceId ? 'bg-slate-700' : ''
                              }`}
                            >
                              {camera.label || `Caméra ${index + 1}`}
                            </button>
                          ))}
                        </div>
                        <div className="border-t border-slate-700 pt-3">
                          <p className="text-sm font-semibold text-slate-300 mb-2">Qualité vidéo:</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setVideoQuality('SD');
                                if (streamRef.current) switchCamera(selectedCameraId);
                              }}
                              className={`flex-1 py-1.5 text-sm font-semibold rounded transition-colors ${
                                videoQuality === 'SD'
                                  ? 'bg-[#C8F135] text-black'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              SD
                            </button>
                            <button
                              onClick={() => {
                                setVideoQuality('HD');
                                if (streamRef.current) switchCamera(selectedCameraId);
                              }}
                              className={`flex-1 py-1.5 text-sm font-semibold rounded transition-colors ${
                                videoQuality === 'HD'
                                  ? 'bg-[#C8F135] text-black'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              HD
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {videoQuality === 'HD' ? '1280×720' : '640×480'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-6">
                    {!isRecording ? (
                      <button
                        onClick={startRecordingPoint}
                        data-tour-id="tour-record-button"
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-bold shadow-lg transform active:scale-95 transition-all landscape-mobile:px-3 landscape-mobile:py-2 landscape-mobile:text-sm"
                      >
                        <Camera className="w-5 h-5 landscape-mobile:w-4 landscape-mobile:h-4" />
                        <span>Enregistrer vidéo</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopCurrentPointRecording}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-full font-bold shadow-lg border border-red-500 transform active:scale-95 transition-all landscape-mobile:px-3 landscape-mobile:py-2 landscape-mobile:text-sm"
                      >
                        <StopCircle className="w-5 h-5 text-red-500 landscape-mobile:w-4 landscape-mobile:h-4" />
                        <span>Stop</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-br from-[#0f1e35]/50 to-[#0a1628]/50 rounded-xl p-2 sm:p-4 shadow-inner border border-white/5 flex-shrink-0">
            <div className="flex items-center justify-center">
              <div className="flex-1 min-w-0">
                <table className="w-full bg-white/5 backdrop-blur-sm rounded-lg shadow-sm overflow-hidden border border-white/10">
                  <tbody>
                    <tr className="border-b border-white/10">
                      <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-200 bg-white/5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                            <span className="truncate">Adversaire</span>
                            {currentServer === 'adversaire' && (
                              <img src="/tennis-ball.svg" alt="Serving" className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {isMatchFinished && retirementPlayer === 'adversaire' && (
                              <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">
                                Abandon
                              </span>
                            )}
                            {!isMatchFinished && !isTiebreak && gameScore.totalAd !== undefined && gameScore.totalAd > 1 && (
                              <span className="px-1.5 py-0.5 bg-gray-400 text-white text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">
                                Deuce {gameScore.totalAd}
                              </span>
                            )}
                            {!isMatchFinished && isMatchPoint(gameScore, setScores, 'adversaire') && (
                              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">
                                Match Point
                              </span>
                            )}
                            {!isMatchFinished && !isMatchPoint(gameScore, setScores, 'adversaire') && isSetPoint(gameScore, setScores, 'adversaire') && (
                              <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">
                                Set Point
                              </span>
                            )}
                            {!isMatchFinished && !isSetPoint(gameScore, setScores, 'adversaire') && currentServer === 'adversaire' && willWinGame(gameScore, 'adversaire') && (
                              <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">
                                Game Point
                              </span>
                            )}
                            {!isMatchFinished && !isSetPoint(gameScore, setScores, 'adversaire') && currentServer === 'famille' && willWinGame(gameScore, 'adversaire') && (
                              <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">
                                Break Point
                              </span>
                            )}
                            <button
                              onClick={() => !isLocked && scorePoint('adversaire')}
                              disabled={isLocked || isMatchFinished}
                              data-tour-id="tour-score-cell"
                              className={`w-10 h-6 sm:w-12 sm:h-7 flex items-center justify-center bg-red-500 text-white text-xs sm:text-sm font-bold rounded shadow transition-all flex-shrink-0 ${
                                !isLocked && !isMatchFinished ? 'hover:bg-red-600 cursor-pointer' : 'cursor-not-allowed opacity-90'
                              }`}
                              title={!isLocked ? 'Cliquer pour ajouter un point' : ''}
                            >
                              {getDisplayScore(gameScore.adversaire)}
                            </button>
                          </div>
                        </div>
                      </td>
                      {[0, 1, 2].map(i => (
                        <td key={i} className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-sm sm:text-base font-bold ${currentSet === i ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'}`}>
                          {setScores.adversaire[i]}
                          {tiebreakScores[i] && !(i === 2 && gameFormat.supertiebreak) && <sup className="text-xs">{tiebreakScores[i].adversaire}</sup>}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-200 bg-white/5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                            <span className="truncate">{selectedPlayer || 'Joueur'}</span>
                            {currentServer === 'famille' && (
                              <img src="/tennis-ball.svg" alt="Serving" className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {isMatchFinished && retirementPlayer === 'famille' && (
                              <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">
                                Abandon
                              </span>
                            )}
                            {!isMatchFinished && isMatchPoint(gameScore, setScores, 'famille') && (
                              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">
                                Match Point
                              </span>
                            )}
                            {!isMatchFinished && !isMatchPoint(gameScore, setScores, 'famille') && isSetPoint(gameScore, setScores, 'famille') && (
                              <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">
                                Set Point
                              </span>
                            )}
                            {!isMatchFinished && !isSetPoint(gameScore, setScores, 'famille') && currentServer === 'famille' && willWinGame(gameScore, 'famille') && (
                              <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">
                                Game Point
                              </span>
                            )}
                            {!isMatchFinished && !isSetPoint(gameScore, setScores, 'famille') && currentServer === 'adversaire' && willWinGame(gameScore, 'famille') && (
                              <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">
                                Break Point
                              </span>
                            )}
                            <button
                              onClick={() => !isLocked && scorePoint('famille')}
                              disabled={isLocked || isMatchFinished}
                              className={`w-10 h-6 sm:w-12 sm:h-7 flex items-center justify-center bg-green-500 text-white text-xs sm:text-sm font-bold rounded shadow transition-all flex-shrink-0 ${
                                !isLocked && !isMatchFinished ? 'hover:bg-green-600 cursor-pointer' : 'cursor-not-allowed opacity-90'
                              }`}
                              title={!isLocked ? 'Cliquer pour ajouter un point' : ''}
                            >
                              {getDisplayScore(gameScore.famille)}
                            </button>
                          </div>
                        </div>
                      </td>
                      {[0, 1, 2].map(i => (
                        <td key={i} className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-sm sm:text-base font-bold ${currentSet === i ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'}`}>
                          {setScores.famille[i]}
                          {tiebreakScores[i] && !(i === 2 && gameFormat.supertiebreak) && <sup className="text-xs">{tiebreakScores[i].famille}</sup>}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {isTiebreak && (
              <div className="text-center mt-2 text-sm font-semibold text-[#C8F135]">
                {shouldStartSupertiebreak() && currentSet === 2 ? 'Super Tie-Break' : 'Tie-Break'}
              </div>
            )}
          </div>

              <div className="flex-shrink-0 px-3 sm:p-4">
                <div className="max-w-md mx-auto w-full space-y-1">
                  {['forehand', 'backhand', 'volley', 'service', 'return', 'opponent'].map((skill) => (
                    <div
                      key={skill}
                      data-tour-id={skill === 'forehand' ? 'tour-skill-row-forehand' : skill === 'opponent' ? 'tour-skill-row-opponent' : undefined}
                      className={`flex items-center gap-1.5 p-1.5 rounded-lg transition-all border ${
                        highlightedRow.row === skill
                          ? highlightedRow.color === 'green'
                            ? 'bg-green-500/20 border-green-500/50'
                            : 'bg-red-500/20 border-red-500/50'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <span className="w-20 text-xs font-medium text-gray-300">{translateSkillLabel(skill)}</span>
                      <button
                        onClick={() => setFault(skill)}
                        disabled={!!pressedButton.skill || isMatchFinished}
                        className="flex-1 px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Faute
                      </button>
                      <button
                        onClick={() => setWon(skill)}
                        disabled={!!pressedButton.skill || isMatchFinished}
                        className="flex-1 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Gagne
                      </button>
                      <div className="w-8 shrink-0 flex flex-col gap-1">
                        <GaugeBar pct={liveSkillWinPct[skill] ?? 0} sizeClassName="h-1.5" />
                        <GaugeBar pct={liveSkillLossPct[skill] ?? 0} sizeClassName="h-1.5" color="#ef4444" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="max-w-md mx-auto w-full mt-3">
                  <button
                    onClick={handleFinishMatch}
                    disabled={isSaving}
                    data-tour-id="tour-finish-button"
                    className="w-full px-4 py-3 bg-[#C8F135] text-[#050d1a] rounded-lg font-bold hover:bg-[#b5d930] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-5 h-5 border-2 border-[#050d1a] border-t-transparent rounded-full animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      'Terminer le Match'
                    )}
                  </button>

                  {isMatchFinished && !isSaving && (
                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 text-center mt-2">
                      <p className="text-green-400 font-semibold text-sm">Match terminé !</p>
                      <p className="text-green-300 text-xs mt-1">Cliquez sur "Terminer le Match" pour enregistrer</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-3 py-4 sm:p-4 bg-[#0a1628]/50 border-t border-white/10">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Historique des Points</h3>
                <div className="space-y-3 pr-2">
                  {scoringHistory.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm italic">
                      Aucun point enregistré pour le moment
                    </div>
                  )}
                  {scoringHistory.slice().reverse().map((entry, index) => {
                    const isWin = entry.toggleValue && entry.toggleValue.includes('Gagne');
                    const isFault = entry.toggleValue && entry.toggleValue.includes('Faute');
                    const isUploading = entry.uploading || uploadingEntries.has(entry.sequence);

                    return (
                      <div key={entry.sequence || index} className="bg-white/5 backdrop-blur-sm rounded-lg shadow-sm border border-white/10 p-3 flex gap-3 items-start">
                        <div className="w-20 h-20 bg-black/30 rounded flex items-center justify-center shrink-0 overflow-hidden relative border border-white/10">
                          {entry.videoUrl ? (
                            <>
                              <video src={getPlaybackUrl(entry.videoUrl) || undefined} className="w-full h-full object-cover" muted playsInline />
                              <button
                                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPlayingVideoUrl(getPlaybackUrl(entry.videoUrl));
                                }}
                              >
                                <Play className="text-white w-8 h-8 opacity-80 fill-white" />
                              </button>
                            </>
                          ) : (
                            <div className="text-gray-500">
                              <Camera className="w-8 h-8" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1 gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10">
                                #{entry.sequence}
                              </span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                entry.player === 'famille'
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {entry.player === 'famille' ? 'Point gagné' : 'Point perdu'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {entry.duration && (
                                <span className="flex items-center gap-1 text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded font-mono border border-white/10">
                                  <Clock className="w-2.5 h-2.5" />
                                  {entry.duration}s
                                </span>
                              )}
                              {isUploading ? (
                                <div className="flex items-center gap-1 text-[10px] text-orange-400 font-medium bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-500/30">
                                  <Upload className="w-2.5 h-2.5" />
                                  <span>Uploading...</span>
                                </div>
                              ) : entry.videoUrl ? (
                                <div className="flex items-center gap-1 text-[10px] text-green-400 font-medium bg-green-500/20 px-1.5 py-0.5 rounded border border-green-500/30">
                                  <CheckCircle className="w-2.5 h-2.5" />
                                  <span>Uploaded</span>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-1">
                            <p className="font-semibold text-gray-200 text-sm">
                              {formatToggleValueDisplay(entry.toggleValue)}
                            </p>
                            {entry.server && (
                              <p className="text-xs text-[#C8F135] font-medium mt-0.5">
                                Service: {entry.server === 'famille' ? (selectedPlayer || 'Joueur') : 'Adversaire'}
                              </p>
                            )}
                            {entry.timestamp && (
                              <p className="text-xs text-gray-400 font-medium mt-0.5">
                                {(() => {
                                  const date = new Date(entry.timestamp);
                                  const year = date.getFullYear();
                                  const month = String(date.getMonth() + 1).padStart(2, '0');
                                  const day = String(date.getDate()).padStart(2, '0');
                                  const hours = String(date.getHours()).padStart(2, '0');
                                  const minutes = String(date.getMinutes()).padStart(2, '0');
                                  const seconds = String(date.getSeconds()).padStart(2, '0');
                                  return `${year}-${month}-${day}_${hours}:${minutes}:${seconds}`;
                                })()}
                              </p>
                            )}
                            {entry.gameScore && entry.setScores && (
                              <div className="mt-2">
                                <MiniScoreboard
                                  playerName={selectedPlayer}
                                  opponentName="Adversaire"
                                  gameScore={entry.gameScore}
                                  setScores={entry.setScores}
                                  currentSet={entry.currentSet ?? currentSet}
                                  isTiebreak={entry.isTiebreak ?? false}
                                  currentServer={entry.server}
                                  gameFormat={gameFormat}
                                  tiebreakScores={tiebreakScores}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {isMatchFinished && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {!showSetupModal && (
                <div className="bg-black relative w-full aspect-video max-h-[30vh] flex-shrink-0">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${!videoEnabled ? 'invisible' : ''}`}
                    onLoadedMetadata={(e) => {
                      console.log('Video metadata loaded:', e.currentTarget.videoWidth, 'x', e.currentTarget.videoHeight);
                      e.currentTarget.play().catch(err => console.error('Play error:', err));
                    }}
                    onCanPlay={(e) => {
                      console.log('Video can play');
                      e.currentTarget.play().catch(err => console.error('Play error on canplay:', err));
                    }}
                  />

                  {!videoEnabled && (
                    <div className="absolute inset-0 w-full h-full bg-black" />
                  )}

                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <button
                      onClick={() => setVideoEnabled(!videoEnabled)}
                      className="p-2 bg-gray-800/70 text-white rounded-full hover:bg-gray-700/80 transition-colors backdrop-blur-sm"
                      title={videoEnabled ? "Masquer la vidéo" : "Afficher la vidéo"}
                    >
                      {videoEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    {isRecording && (
                      <div className="flex items-center gap-2 bg-red-600/80 px-3 py-1 rounded-full animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                        <span className="text-white text-xs font-bold uppercase">REC</span>
                      </div>
                    )}
                  </div>

                  <div className="absolute top-4 right-4">
                    <button
                      onClick={() => setShowCameraSelector(!showCameraSelector)}
                      className="p-3 bg-gray-800/70 text-white rounded-full hover:bg-gray-700/80 transition-colors backdrop-blur-sm"
                      title="Choisir la caméra"
                    >
                      <Settings className="w-5 h-5" />
                    </button>

                    {showCameraSelector && (
                      <div className="absolute right-0 mt-2 bg-slate-800 rounded shadow-xl border border-slate-700 p-3 min-w-[220px] z-10">
                        <p className="text-sm font-semibold text-slate-300 mb-2">Sélectionner une caméra:</p>
                        <div className="space-y-2 mb-3">
                          {availableCameras.length === 0 && (
                            <button
                              onClick={() => enumerateCameras()}
                              className="text-sm text-blue-400 hover:text-blue-300"
                            >
                              Détecter les caméras
                            </button>
                          )}
                          {availableCameras.map((camera, index) => (
                            <button
                              key={camera.deviceId}
                              onClick={() => {
                                switchCamera(camera.deviceId);
                                setShowCameraSelector(false);
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition-colors ${
                                selectedCameraId === camera.deviceId ? 'bg-slate-700' : ''
                              }`}
                            >
                              {camera.label || `Caméra ${index + 1}`}
                            </button>
                          ))}
                        </div>
                        <div className="border-t border-slate-700 pt-3">
                          <p className="text-sm font-semibold text-slate-300 mb-2">Qualité vidéo:</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setVideoQuality('SD');
                                if (streamRef.current) switchCamera(selectedCameraId);
                              }}
                              className={`flex-1 py-1.5 text-sm font-semibold rounded transition-colors ${
                                videoQuality === 'SD'
                                  ? 'bg-[#C8F135] text-black'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              SD
                            </button>
                            <button
                              onClick={() => {
                                setVideoQuality('HD');
                                if (streamRef.current) switchCamera(selectedCameraId);
                              }}
                              className={`flex-1 py-1.5 text-sm font-semibold rounded transition-colors ${
                                videoQuality === 'HD'
                                  ? 'bg-[#C8F135] text-black'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              HD
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {videoQuality === 'HD' ? '1280×720' : '640×480'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-6">
                    {!isRecording ? (
                      <button
                        onClick={startRecordingPoint}
                        data-tour-id="tour-record-button"
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-bold shadow-lg transform active:scale-95 transition-all"
                      >
                        <Camera className="w-5 h-5" />
                        <span>Enregistrer vidéo</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopCurrentPointRecording}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-full font-bold shadow-lg border border-red-500 transform active:scale-95 transition-all"
                      >
                        <StopCircle className="w-5 h-5 text-red-500" />
                        <span>Stop</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-br from-[#0f1e35]/50 to-[#0a1628]/50 rounded-xl p-2 sm:p-4 shadow-inner border border-white/5 flex-shrink-0">
                <div className="flex items-center justify-center">
                  <div className="flex-1 min-w-0">
                    <table className="w-full bg-white/5 backdrop-blur-sm rounded-lg shadow-sm overflow-hidden border border-white/10">
                      <tbody>
                        <tr className="border-b border-white/10">
                          <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-200 bg-white/5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                                <span className="truncate">Adversaire</span>
                                {currentServer === 'adversaire' && (
                                  <img src="/tennis-ball.svg" alt="Serving" className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {isMatchFinished && retirementPlayer === 'adversaire' && (
                                  <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] sm:text-xs font-bold rounded">
                                    AB
                                  </span>
                                )}
                                {!isMatchFinished && !isTiebreak && gameScore.totalAd !== undefined && gameScore.totalAd > 1 && (
                                  <span className="px-1.5 py-0.5 bg-gray-400 text-white text-[10px] sm:text-xs font-bold rounded">
                                    Deuce {gameScore.totalAd}
                                  </span>
                                )}
                                {!isMatchFinished && isMatchPoint(gameScore, setScores, 'adversaire') && (
                                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded">
                                    MP
                                  </span>
                                )}
                                {!isMatchFinished && !isMatchPoint(gameScore, setScores, 'adversaire') && isSetPoint(gameScore, setScores, 'adversaire') && (
                                  <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] sm:text-xs font-bold rounded">
                                    SP
                                  </span>
                                )}
                                {!isMatchFinished && !isSetPoint(gameScore, setScores, 'adversaire') && currentServer === 'adversaire' && willWinGame(gameScore, 'adversaire') && (
                                  <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] sm:text-xs font-bold rounded">
                                    GP
                                  </span>
                                )}
                                {!isMatchFinished && !isSetPoint(gameScore, setScores, 'adversaire') && currentServer === 'famille' && willWinGame(gameScore, 'adversaire') && (
                                  <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] sm:text-xs font-bold rounded">
                                    BP
                                  </span>
                                )}
                                <button
                                  onClick={() => !isLocked && scorePoint('adversaire')}
                                  disabled={isLocked || isMatchFinished}
                                  className={`w-10 h-6 sm:w-12 sm:h-7 flex items-center justify-center bg-red-500 text-white text-xs sm:text-sm font-bold rounded shadow transition-all flex-shrink-0 ${
                                    !isLocked && !isMatchFinished ? 'hover:bg-red-600 cursor-pointer' : 'cursor-not-allowed opacity-90'
                                  }`}
                                  title={!isLocked ? 'Cliquer pour ajouter un point' : ''}
                                >
                                  {getDisplayScore(gameScore.adversaire)}
                                </button>
                              </div>
                            </div>
                          </td>
                          {[0, 1, 2].map(i => (
                            <td key={i} className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-sm sm:text-base font-bold ${currentSet === i ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'}`}>
                              {setScores.adversaire[i]}
                              {tiebreakScores[i] && !(i === 2 && gameFormat.supertiebreak) && <sup className="text-xs">{tiebreakScores[i].adversaire}</sup>}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-200 bg-white/5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                                <span className="truncate">{selectedPlayer || 'Joueur'}</span>
                                {currentServer === 'famille' && (
                                  <img src="/tennis-ball.svg" alt="Serving" className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {isMatchFinished && retirementPlayer === 'famille' && (
                                  <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] sm:text-xs font-bold rounded">
                                    AB
                                  </span>
                                )}
                                {!isMatchFinished && isMatchPoint(gameScore, setScores, 'famille') && (
                                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded">
                                    MP
                                  </span>
                                )}
                                {!isMatchFinished && !isMatchPoint(gameScore, setScores, 'famille') && isSetPoint(gameScore, setScores, 'famille') && (
                                  <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] sm:text-xs font-bold rounded">
                                    SP
                                  </span>
                                )}
                                {!isMatchFinished && !isSetPoint(gameScore, setScores, 'famille') && currentServer === 'famille' && willWinGame(gameScore, 'famille') && (
                                  <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] sm:text-xs font-bold rounded">
                                    GP
                                  </span>
                                )}
                                {!isMatchFinished && !isSetPoint(gameScore, setScores, 'famille') && currentServer === 'adversaire' && willWinGame(gameScore, 'famille') && (
                                  <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] sm:text-xs font-bold rounded">
                                    BP
                                  </span>
                                )}
                                <button
                                  onClick={() => !isLocked && scorePoint('famille')}
                                  disabled={isLocked || isMatchFinished}
                                  className={`w-10 h-6 sm:w-12 sm:h-7 flex items-center justify-center bg-green-500 text-white text-xs sm:text-sm font-bold rounded shadow transition-all flex-shrink-0 ${
                                    !isLocked && !isMatchFinished ? 'hover:bg-green-600 cursor-pointer' : 'cursor-not-allowed opacity-90'
                                  }`}
                                  title={!isLocked ? 'Cliquer pour ajouter un point' : ''}
                                >
                                  {getDisplayScore(gameScore.famille)}
                                </button>
                              </div>
                            </div>
                          </td>
                          {[0, 1, 2].map(i => (
                            <td key={i} className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-sm sm:text-base font-bold ${currentSet === i ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'}`}>
                              {setScores.famille[i]}
                              {tiebreakScores[i] && !(i === 2 && gameFormat.supertiebreak) && <sup className="text-xs">{tiebreakScores[i].famille}</sup>}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                {isTiebreak && (
                  <div className="text-center mt-2 text-sm font-semibold text-[#C8F135]">
                    {shouldStartSupertiebreak() && currentSet === 2 ? 'Super Tie-Break' : 'Tie-Break'}
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 px-3 sm:p-4">
                <div className="max-w-md mx-auto w-full">
                  <button
                    onClick={handleFinishMatch}
                    disabled={isSaving}
                    data-tour-id="tour-finish-button"
                    className="w-full px-4 py-3 bg-[#C8F135] text-[#050d1a] rounded-lg font-bold hover:bg-[#b5d930] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-5 h-5 border-2 border-[#050d1a] border-t-transparent rounded-full animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      'Terminer le Match'
                    )}
                  </button>

                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 text-center mt-2">
                    <p className="text-green-400 font-semibold text-sm">Match terminé !</p>
                    <p className="text-green-300 text-xs mt-1">Cliquez sur "Terminer le Match" pour enregistrer</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:p-4 bg-[#0a1628]/50 border-t border-white/10">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Historique des Points</h3>
                <div className="space-y-3 pr-2">
                {scoringHistory.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm italic">
                    Aucun point enregistré pour le moment
                  </div>
                )}
                {scoringHistory.slice().reverse().map((entry, index) => {
                  const isWin = entry.toggleValue && entry.toggleValue.includes('Gagne');
                  const isFault = entry.toggleValue && entry.toggleValue.includes('Faute');
                  const isUploading = entry.uploading || uploadingEntries.has(entry.sequence);

                  return (
                    <div key={entry.sequence || index} className="bg-white/5 backdrop-blur-sm rounded-lg shadow-sm border border-white/10 p-3 flex gap-3 items-start">
                      <div className="w-20 h-20 bg-black/30 rounded flex items-center justify-center shrink-0 overflow-hidden relative border border-white/10">
                        {entry.videoUrl ? (
                          <>
                            <video src={getPlaybackUrl(entry.videoUrl) || undefined} className="w-full h-full object-cover" muted playsInline />
                            <a
                              href={getPlaybackUrl(entry.videoUrl) || undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Camera className="text-white w-8 h-8 opacity-80" />
                            </a>
                          </>
                        ) : (
                          <div className="text-gray-500">
                            <Camera className="w-8 h-8" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10">
                              #{entry.sequence}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              entry.player === 'famille'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {entry.player === 'famille' ? 'Point gagné' : 'Point perdu'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {entry.duration && (
                              <span className="flex items-center gap-1 text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded font-mono border border-white/10">
                                <Clock className="w-2.5 h-2.5" />
                                {entry.duration}s
                              </span>
                            )}
                            {isUploading ? (
                              <div className="flex items-center gap-1 text-[10px] text-orange-400 font-medium bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-500/30">
                                <Upload className="w-2.5 h-2.5" />
                                <span>Uploading...</span>
                              </div>
                            ) : entry.videoUrl ? (
                              <div className="flex items-center gap-1 text-[10px] text-green-400 font-medium bg-green-500/20 px-1.5 py-0.5 rounded border border-green-500/30">
                                <CheckCircle className="w-2.5 h-2.5" />
                                <span>Uploaded</span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-1">
                          <p className="font-semibold text-gray-200 text-sm">
                            {formatToggleValueDisplay(entry.toggleValue)}
                          </p>
                          {entry.server && (
                            <p className="text-xs text-[#C8F135] font-medium mt-0.5">
                              Service: {entry.server === 'famille' ? (selectedPlayer || 'Joueur') : 'Adversaire'}
                            </p>
                          )}
                          {entry.timestamp && (
                            <p className="text-xs text-gray-400 font-medium mt-0.5">
                              {(() => {
                                const date = new Date(entry.timestamp);
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const day = String(date.getDate()).padStart(2, '0');
                                const hours = String(date.getHours()).padStart(2, '0');
                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                const seconds = String(date.getSeconds()).padStart(2, '0');
                                return `${year}-${month}-${day}_${hours}:${minutes}:${seconds}`;
                              })()}
                            </p>
                          )}
                          {entry.gameScore && entry.setScores && (
                            <div className="mt-2">
                              <MiniScoreboard
                                playerName={selectedPlayer}
                                opponentName="Adversaire"
                                gameScore={entry.gameScore}
                                setScores={entry.setScores}
                                currentSet={entry.currentSet ?? currentSet}
                                isTiebreak={entry.isTiebreak ?? false}
                                currentServer={entry.server}
                                gameFormat={gameFormat}
                                tiebreakScores={tiebreakScores}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {playingVideoUrl && (
      <VideoPlayerModal
        videoUrl={playingVideoUrl}
        onClose={() => setPlayingVideoUrl(null)}
        title="Video du Point"
      />
    )}
    {showRetirementPrompt && (
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
        onClick={() => setShowRetirementPrompt(false)}
      >
        <div
          className="bg-gradient-to-br from-[#0a1628] to-[#050d1a] rounded-xl shadow-2xl border border-white/10 max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-xl font-bold text-white mb-2">Terminer la partie</h3>
          <p className="text-gray-300 mb-6 text-sm">
            La partie n'est pas terminée. Y mettre fin maintenant est un abandon - sélectionnez le joueur qui abandonne, l'autre sera déclaré vainqueur.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => confirmRetirement('famille')}
              className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
            >
              <span className="block text-sm font-semibold text-white">{selectedPlayer || 'Joueur'} abandonne</span>
              <span className="block text-xs text-gray-400 mt-0.5">Adversaire remporte le match</span>
            </button>
            <button
              onClick={() => confirmRetirement('adversaire')}
              className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
            >
              <span className="block text-sm font-semibold text-white">Adversaire abandonne</span>
              <span className="block text-xs text-gray-400 mt-0.5">{selectedPlayer || 'Joueur'} remporte le match</span>
            </button>
          </div>
          <button
            onClick={() => setShowRetirementPrompt(false)}
            className="w-full mt-4 px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    )}
    </>
  );
}