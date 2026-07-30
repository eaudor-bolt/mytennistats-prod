import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Pause, ScanFace, AlertCircle, ChevronLeft, ChevronRight, TrendingUp, Activity, Trash2, RotateCcw, Maximize, Minimize, Star, User, Calendar, Tag as TagIcon, Download, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    Pose: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_LANDMARKS_LEFT: any;
    POSE_LANDMARKS_RIGHT: any;
    POSE_CONNECTIONS: any;
  }
}

const POSE_LANDMARKS = [
  { id: 0, name: "Nose" }, { id: 11, name: "Left Shoulder" }, { id: 12, name: "Right Shoulder" },
  { id: 13, name: "Left Elbow" }, { id: 14, name: "Right Elbow" }, { id: 15, name: "Left Wrist" },
  { id: 16, name: "Right Wrist" }, { id: 23, name: "Left Hip" }, { id: 24, name: "Right Hip" },
  { id: 25, name: "Left Knee" }, { id: 26, name: "Right Knee" }, { id: 27, name: "Left Ankle" },
  { id: 28, name: "Right Ankle" }
];

type VideoMetadata = {
  playerName?: string;
  shotType?: string;
  date?: string;
  tags?: { id: string; name: string }[];
};

type VideoPlayerModalProps = {
  videoUrl: string;
  onClose: () => void;
  title?: string;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  metadata?: VideoMetadata;
};

export function VideoPlayerModal({ videoUrl, onClose, title = 'Video du Point', favorite, onToggleFavorite, metadata }: VideoPlayerModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [poseError, setPoseError] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<number>(16);
  const [graphUpdateTrigger, setGraphUpdateTrigger] = useState(0);
  const [graphPosition, setGraphPosition] = useState({ x: 20, y: 20 });
  const [isDraggingGraph, setIsDraggingGraph] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [isGraphCollapsed, setIsGraphCollapsed] = useState(false);
  const [graphMode, setGraphMode] = useState<'timeSeries' | '2dPosition'>('timeSeries');
  const [showXAxis, setShowXAxis] = useState(true);
  const [showYAxis, setShowYAxis] = useState(true);
  const [showZAxis, setShowZAxis] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoAreaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphCanvasRef = useRef<HTMLCanvasElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const graphHistoryRef = useRef<{time: number, landmarks: {x: number, y: number, z: number}[]}[]>([]);
  const previousTimeRef = useRef<number>(0);

  useEffect(() => {
    const scripts: HTMLScriptElement[] = [];
    const srcs = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
    ];

    srcs.forEach(src => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (!existing) {
        const s = document.createElement('script');
        s.src = src;
        s.crossOrigin = 'anonymous';
        document.body.appendChild(s);
        scripts.push(s);
      }
    });

    return () => {
      scripts.forEach(s => {
        if (s.parentNode) s.parentNode.removeChild(s);
      });
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    graphHistoryRef.current = [];
    setGraphUpdateTrigger(0);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
    setAutoplayBlocked(false);

    const attemptPlay = () => {
      if (videoRef.current && mounted) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => { if (mounted) { setAutoplayBlocked(false); setIsPlaying(true); } })
            .catch(() => { if (mounted) { setAutoplayBlocked(true); setIsPlaying(false); } });
        }
      }
    };

    const playTimeout = setTimeout(attemptPlay, 200);

    const initPose = () => {
      if (window.Pose && mounted) {
        try {
          const pose = new window.Pose({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
          });
          pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          pose.onResults(onResults);
          if (mounted) {
            poseRef.current = pose;
            setPoseError(false);
          }
        } catch {
          if (mounted) { poseRef.current = null; setPoseError(true); }
        }
      } else if (mounted) {
        setTimeout(initPose, 500);
      }
    };

    initPose();

    return () => {
      mounted = false;
      clearTimeout(playTimeout);
      if (poseRef.current) {
        try { poseRef.current.close(); } catch {}
        poseRef.current = null;
      }
    };
  }, [videoUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const drawGraph = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const history = graphHistoryRef.current;
    ctx.clearRect(0, 0, width, height);

    if (graphMode === '2dPosition') {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();

      if (history.length === 0) return;
      const landmarkData = history
        .filter(h => h.landmarks[selectedLandmarkId])
        .map(h => ({ x: h.landmarks[selectedLandmarkId].x, y: h.landmarks[selectedLandmarkId].y }));
      if (landmarkData.length === 0) return;

      ctx.fillStyle = '#ec4899';
      landmarkData.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x * width, point.y * height, 12, 0, 2 * Math.PI);
        ctx.fill();
      });
    } else {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();

      if (history.length === 0) return;
      const sortedHistory = [...history].sort((a, b) => a.time - b.time);
      const maxTime = sortedHistory[sortedHistory.length - 1].time || 0.1;

      const landmarkData = sortedHistory
        .filter(h => h.landmarks[selectedLandmarkId])
        .map(h => ({
          time: h.time,
          x: h.landmarks[selectedLandmarkId].x,
          y: h.landmarks[selectedLandmarkId].y,
          z: h.landmarks[selectedLandmarkId].z
        }));
      if (landmarkData.length === 0) return;

      const drawLine = (color: string, getValue: (p: {x: number, y: number, z: number}) => number) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        let started = false;
        landmarkData.forEach((point) => {
          const x = (point.time / maxTime) * width;
          const y = getValue(point) * height;
          if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        });
        ctx.stroke();
      };

      if (showXAxis) drawLine('#f87171', p => p.x);
      if (showYAxis) drawLine('#60a5fa', p => p.y);
      if (showZAxis) drawLine('#4ade80', p => Math.abs(p.z));
    }
  }, [graphMode, selectedLandmarkId, showXAxis, showYAxis, showZAxis]);

  const onResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (results.poseLandmarks) {
        if (window.drawConnectors && window.POSE_CONNECTIONS) {
          window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, {color: '#00ff00', lineWidth: 4});
        }
        if (window.drawLandmarks) {
          window.drawLandmarks(ctx, results.poseLandmarks, {color: '#ff0000', lineWidth: 2, radius: 6});
          const selected = results.poseLandmarks[selectedLandmarkId];
          if (selected) {
            ctx.beginPath();
            ctx.arc(selected.x * canvas.width, selected.y * canvas.height, 8, 0, 2 * Math.PI);
            ctx.fillStyle = '#facc15';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    if (results.poseLandmarks && results.poseLandmarks.length > 0) {
      const ct = video.currentTime;
      const history = graphHistoryRef.current;
      const lastPoint = history[history.length - 1];
      if (!lastPoint || Math.abs(lastPoint.time - ct) > 0.05) {
        history.push({
          time: ct,
          landmarks: results.poseLandmarks.map((lm: any) => ({ x: lm.x, y: lm.y, z: lm.z }))
        });
        setGraphUpdateTrigger(prev => prev + 1);
      }
    }
  }, [selectedLandmarkId]);

  useEffect(() => {
    let errorCount = 0;
    const maxErrors = 5;

    const processFrame = async () => {
      if (poseError || errorCount >= maxErrors) {
        if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
        return;
      }
      if (isAnalyzing && videoRef.current && !videoRef.current.paused && !videoRef.current.ended && poseRef.current) {
        try {
          await poseRef.current.send({image: videoRef.current});
          errorCount = 0;
        } catch {
          errorCount++;
          if (errorCount >= maxErrors) { setPoseError(true); setIsAnalyzing(false); }
        }
      }
      if (isAnalyzing && !poseError && errorCount < maxErrors) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    if (isAnalyzing && !poseError) { errorCount = 0; processFrame(); }
    else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isAnalyzing, isPlaying, poseError]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentTime(t);
      previousTimeRef.current = t;
      if (graphCanvasRef.current && isAnalyzing) {
        const gCtx = graphCanvasRef.current.getContext('2d');
        if (gCtx) drawGraph(gCtx, graphCanvasRef.current.width, graphCanvasRef.current.height);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const handleEnded = () => setIsPlaying(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play()
          .then(() => { setIsPlaying(true); setAutoplayBlocked(false); })
          .catch(() => { setAutoplayBlocked(true); setIsPlaying(false); });
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    const filename = decodeURIComponent(videoUrl.split('/').pop()?.split('?')[0] || 'video.mp4');
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Cross-origin fetch failed (e.g. CORS): fall back to opening the
      // video directly so the user can still save it manually.
      window.open(videoUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleFullscreen = () => {
    // Fullscreen the video area itself, not the whole modal card - the
    // modal has its own padding/border/rounded corners, which stayed
    // visible around the edges when those were what went fullscreen.
    const container = videoAreaRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimer]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const pushedHistoryRef = useRef(false);
  useEffect(() => {
    window.history.pushState({ videoModal: true }, '');
    pushedHistoryRef.current = true;

    const handlePopState = () => {
      pushedHistoryRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleClose = useCallback(() => {
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    } else {
      onCloseRef.current();
    }
  }, []);

  const handleSeek = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      const isForward = time > previousTimeRef.current;
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      previousTimeRef.current = time;
      if (isForward && isAnalyzing) { await frameStep('forward'); await frameStep('forward'); }
    }
  };

  const frameStep = async (direction: 'forward' | 'backward') => {
    if (!videoRef.current) return;
    const frameDuration = 1 / 30;
    const newTime = direction === 'forward'
      ? Math.min(videoRef.current.currentTime + frameDuration, duration)
      : Math.max(videoRef.current.currentTime - frameDuration, 0);

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    previousTimeRef.current = newTime;

    if (!videoRef.current.paused) { videoRef.current.pause(); setIsPlaying(false); }

    if (isAnalyzing && poseRef.current && videoRef.current) {
      try { await poseRef.current.send({image: videoRef.current}); } catch {}
    }
  };

  const resetGraph = () => {
    graphHistoryRef.current = [];
    if (graphCanvasRef.current) {
      const ctx = graphCanvasRef.current.getContext('2d');
      if (ctx) drawGraph(ctx, graphCanvasRef.current.width, graphCanvasRef.current.height);
    }
  };

  useEffect(() => {
    if (graphCanvasRef.current && isAnalyzing) {
      const ctx = graphCanvasRef.current.getContext('2d');
      if (ctx) drawGraph(ctx, graphCanvasRef.current.width, graphCanvasRef.current.height);
    }
  }, [selectedLandmarkId, isAnalyzing, graphUpdateTrigger, graphMode, showXAxis, showYAxis, showZAxis, drawGraph]);

  const handleGraphTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDraggingGraph(true);
    setDragStartPos({ x: touch.clientX - graphPosition.x, y: touch.clientY - graphPosition.y });
  };

  const handleGraphTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingGraph) return;
    e.preventDefault();
    const touch = e.touches[0];
    const maxX = window.innerWidth - (graphContainerRef.current?.offsetWidth || 240);
    const maxY = window.innerHeight - (graphContainerRef.current?.offsetHeight || 300);
    setGraphPosition({
      x: Math.max(0, Math.min(touch.clientX - dragStartPos.x, maxX)),
      y: Math.max(0, Math.min(touch.clientY - dragStartPos.y, maxY))
    });
  };

  const handleGraphTouchEnd = () => setIsDraggingGraph(false);

  const handleGraphMouseDown = (e: React.MouseEvent) => {
    setIsDraggingGraph(true);
    setDragStartPos({ x: e.clientX - graphPosition.x, y: e.clientY - graphPosition.y });
  };

  useEffect(() => {
    if (!isDraggingGraph) return;
    const move = (e: MouseEvent) => {
      const maxX = window.innerWidth - (graphContainerRef.current?.offsetWidth || 240);
      const maxY = window.innerHeight - (graphContainerRef.current?.offsetHeight || 300);
      setGraphPosition({
        x: Math.max(0, Math.min(e.clientX - dragStartPos.x, maxX)),
        y: Math.max(0, Math.min(e.clientY - dragStartPos.y, maxY))
      });
    };
    const up = () => setIsDraggingGraph(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isDraggingGraph, dragStartPos]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); frameStep('backward'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); frameStep('forward'); }
      else if (e.key === 'Escape') { handleClose(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration, isAnalyzing, handleClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4" onClick={handleClose}>
      <div className="relative w-full max-w-5xl bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95dvh] h-[90dvh] border border-white/20" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/80 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {onToggleFavorite && (
              <button
                onClick={onToggleFavorite}
                className={`p-1.5 rounded-full transition-all ${
                  favorite
                    ? 'text-[#C8F135] bg-[#C8F135]/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Star size={20} className={favorite ? 'fill-current' : ''} />
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="p-1.5 rounded-full transition-all text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-50"
              title="Télécharger la vidéo"
            >
              {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className={`flex items-center gap-2 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-full border transition-colors select-none ${
              poseError ? 'border-red-500/50' : 'border-slate-700 hover:border-green-600'
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
                <div className={`w-8 h-4 bg-slate-700 rounded-full relative transition-colors ${isAnalyzing ? 'bg-green-600/50' : ''}`}>
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isAnalyzing ? 'translate-x-4' : ''}`}></div>
                </div>
              )}
              {poseError && <AlertCircle size={16} className="text-red-400" />}
            </label>
            <button onClick={handleClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
        </div>

        <div
          ref={videoAreaRef}
          className="flex-1 bg-black flex items-center justify-center overflow-hidden relative group"
          onMouseMove={resetControlsTimer}
          onTouchStart={resetControlsTimer}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={videoUrl}
              crossOrigin="anonymous"
              autoPlay
              muted={false}
              playsInline
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onPlay={() => { setAutoplayBlocked(false); setIsPlaying(true); }}
              className="w-full h-full object-contain z-10"
              style={{ backgroundColor: '#000' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
            />

            {metadata && (
              <div className={`absolute top-4 left-4 z-30 bg-slate-900/90 backdrop-blur-md rounded-lg p-3 sm:p-4 border border-slate-700 shadow-2xl transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                  {metadata.playerName && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <User size={12} /> Joueur
                      </span>
                      <span className="text-white font-medium text-sm">{metadata.playerName}</span>
                    </div>
                  )}
                  {metadata.shotType && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Activity size={12} /> Coup
                      </span>
                      <span className="text-white font-medium text-sm">{metadata.shotType}</span>
                    </div>
                  )}
                  {metadata.date && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Calendar size={12} /> Date
                      </span>
                      <span className="text-white font-medium text-sm">{new Date(metadata.date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {metadata.tags && metadata.tags.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <TagIcon size={12} /> Tags
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {metadata.tags.map((tag) => (
                          <span key={tag.id} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-full text-xs">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {autoplayBlocked && !isPlaying && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (videoRef.current) {
                    videoRef.current.play()
                      .then(() => { setAutoplayBlocked(false); setIsPlaying(true); })
                      .catch(() => {});
                  }
                }}
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95">
                  <Play className="text-white ml-2" size={40} fill="white" />
                </div>
              </div>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); frameStep('backward'); }}
              className={`absolute left-2 top-1/2 -translate-y-1/2 z-40 p-2 bg-slate-900/80 hover:bg-slate-800/90 backdrop-blur-sm text-white rounded-lg transition-all hover:scale-110 border border-slate-700 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              title="Previous Frame"
            >
              <ChevronLeft size={28} strokeWidth={2.5} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); frameStep('forward'); }}
              className={`absolute right-2 top-1/2 -translate-y-1/2 z-40 p-2 bg-slate-900/80 hover:bg-slate-800/90 backdrop-blur-sm text-white rounded-lg transition-all hover:scale-110 border border-slate-700 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              title="Next Frame"
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
                  width: windowWidth >= 768 ? '30vw' : '50vw',
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
                      onClick={resetGraph}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="p-1 sm:p-1.5 hover:bg-slate-700 active:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
                      title="Reset"
                    >
                      <Trash2 size={14} className="sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={() => setIsGraphCollapsed(true)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="p-1 sm:p-1.5 hover:bg-slate-700 active:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                      title="Minimize"
                    >
                      <X size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-2 sm:mb-3" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                  <select
                    value={selectedLandmarkId}
                    onChange={(e) => setSelectedLandmarkId(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 sm:px-3 sm:py-2 text-[10px] sm:text-sm text-white focus:ring-2 focus:ring-green-600 outline-none"
                  >
                    {POSE_LANDMARKS.map((lm) => (
                      <option key={lm.id} value={lm.id}>{lm.id}: {lm.name}</option>
                    ))}
                  </select>
                </div>

                <div className="relative w-full bg-slate-800/50 rounded border sm:rounded-lg sm:border-2 border-slate-700 overflow-hidden" style={{ aspectRatio: '2/1' }}>
                  <canvas ref={graphCanvasRef} width={800} height={400} className="w-full h-full" />
                  <div className="absolute top-1 left-1 sm:top-2 sm:left-2 pointer-events-auto z-10">
                    <div className="flex items-center gap-0.5 bg-slate-900/80 backdrop-blur-sm p-0.5 rounded border border-slate-600">
                      <button
                        onClick={() => setGraphMode('timeSeries')}
                        className={`p-1 rounded transition-all ${graphMode === 'timeSeries' ? 'bg-green-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                        title="Time Series"
                      >
                        <TrendingUp size={14} className="sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => setGraphMode('2dPosition')}
                        className={`p-1 rounded transition-all ${graphMode === '2dPosition' ? 'bg-green-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                        title="2D Position"
                      >
                        <Activity size={14} className="sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                  {graphMode === 'timeSeries' && (
                    <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 flex gap-1.5 sm:gap-3 bg-slate-900/70 px-1 py-0.5 sm:px-2 sm:py-1 rounded">
                      <button onClick={() => setShowXAxis(!showXAxis)} className="flex items-center gap-0.5 sm:gap-1.5 cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto">
                        <div className={`w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full ${showXAxis ? 'bg-red-400' : 'bg-slate-600'}`}></div>
                        <span className={`text-[9px] sm:text-xs font-medium ${showXAxis ? 'text-white' : 'text-slate-500'}`}>X</span>
                      </button>
                      <button onClick={() => setShowYAxis(!showYAxis)} className="flex items-center gap-0.5 sm:gap-1.5 cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto">
                        <div className={`w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full ${showYAxis ? 'bg-blue-400' : 'bg-slate-600'}`}></div>
                        <span className={`text-[9px] sm:text-xs font-medium ${showYAxis ? 'text-white' : 'text-slate-500'}`}>Y</span>
                      </button>
                      <button onClick={() => setShowZAxis(!showZAxis)} className="flex items-center gap-0.5 sm:gap-1.5 cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto">
                        <div className={`w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full ${showZAxis ? 'bg-green-400' : 'bg-slate-600'}`}></div>
                        <span className={`text-[9px] sm:text-xs font-medium ${showZAxis ? 'text-white' : 'text-slate-500'}`}>Z</span>
                      </button>
                    </div>
                  )}
                  {graphMode === '2dPosition' && (
                    <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 flex gap-1.5 sm:gap-3 pointer-events-none bg-slate-900/70 px-1 py-0.5 sm:px-2 sm:py-1 rounded">
                      <div className="flex items-center gap-0.5 sm:gap-1.5">
                        <div className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full bg-pink-500"></div>
                        <span className="text-[9px] sm:text-xs text-white font-medium">Position (X,Y)</span>
                      </div>
                    </div>
                  )}
                </div>
                {graphMode === 'timeSeries' && (
                  <div className="flex justify-between mt-1 sm:mt-2 text-[9px] sm:text-xs text-slate-400">
                    <span>00:00</span>
                    <span>{graphHistoryRef.current.length > 0 ? formatTime(graphHistoryRef.current[graphHistoryRef.current.length - 1].time) : '00:00'}</span>
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
                className="fixed z-30 bg-slate-900/95 backdrop-blur-md border-2 border-green-600 rounded-lg p-2 sm:p-3 shadow-2xl hover:bg-slate-800/95 transition-all hover:scale-105"
                style={{ left: `${graphPosition.x}px`, top: `${graphPosition.y}px` }}
                title="Show Graph"
              >
                <div className="flex items-center gap-1 sm:gap-2">
                  <TrendingUp size={16} className="text-green-600 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-sm font-bold text-slate-300">XY</span>
                </div>
              </button>
            )}
          </div>

          <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent z-40 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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
                  <button onClick={togglePlay} className="text-white hover:text-green-600 transition-colors">
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                  </button>
                  <span className="text-sm font-medium text-white font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; }}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Restart"
                  >
                    <RotateCcw size={20} />
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="text-slate-400 hover:text-white transition-colors"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
