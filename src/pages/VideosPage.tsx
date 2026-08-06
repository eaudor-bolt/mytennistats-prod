import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LayoutGrid, List as ListIcon, Plus, Filter, Video as VideoIcon, AlertCircle, RefreshCw, Play, X, Camera, Upload, Loader2, CheckCircle2, Calendar, User, Activity, StopCircle, ScanFace, TrendingUp, Trash2, Pause, RotateCcw, PlayCircle, Tag as TagIcon, CreditCard as Edit, ChevronLeft, ChevronRight, BarChart3, Maximize, Minimize, Star, Download } from 'lucide-react';
import { supabase, Tag } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePlayers } from '../contexts/PlayersContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { MatchAnalysisPage } from './MatchAnalysisPage';
import { uploadVideoToS3, toFinalVideoUrl } from '../utils/s3Upload';
import { deleteVideoFromS3 } from '../utils/s3Delete';
import CourtBackground from '../components/landing/CourtBackground';
import { trackVideoAction, trackButtonClick, trackFilterAction } from '../utils/analytics';
import { useAlert } from '../hooks/useAlert';

type ShotType = 'Forehand' | ' Backhand' | 'Serve' | 'Volley' | 'Smash' | 'Slice' | 'Drop Shot' | 'Other';

interface VideoRecord {
  id: string;
  url: string;
  player_name: string;
  shot_type: ShotType;
  taken_at: string;
  created_at: string;
  poster_image: string;
  status: string;
  favorite: boolean;
  size_bytes?: number | null;
  duration_seconds?: number | null;
  tags?: Tag[];
}

const getVideoDuration = (file: Blob): Promise<number | null> => {
  return new Promise((resolve) => {
    const videoEl = document.createElement('video');
    videoEl.preload = 'metadata';
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(videoEl.src);
      resolve(Number.isFinite(videoEl.duration) ? videoEl.duration : null);
    };
    videoEl.onerror = () => {
      URL.revokeObjectURL(videoEl.src);
      resolve(null);
    };
    videoEl.src = URL.createObjectURL(file);
  });
};

interface FilterState {
  player_name: string;
  shot_type: string;
  date_from: string;
  date_to: string;
  tags: string[];
  favorite: boolean;
}

type ViewMode = 'list' | 'timeline';
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
type ModalMode = 'select' | 'record' | 'details';

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

const VIDEOS_PER_PAGE = 30;

export function VideosPage() {
  const { user } = useAuth();
  const { players } = usePlayers();
  const { limits, canUploadVideo, hasVideoStorageRoom, incrementUsage } = useSubscription();
  const { showAlert, showConfirm, AlertComponent } = useAlert();
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirmVideo, setDeleteConfirmVideo] = useState<VideoRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMatchAnalysis, setShowMatchAnalysis] = useState(false);
  const [playlistMode, setPlaylistMode] = useState(false);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);

  const [mode, setMode] = useState<ModalMode>('select');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [shotType, setShotType] = useState<ShotType>('Forehand');
  const [takenAt, setTakenAt] = useState<string>(new Date().toISOString().substring(0, 16));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [matchId, setMatchId] = useState<string>('');

  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<number | null>(null);
  const videoRecorderRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<number>(16);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [graphUpdateTrigger, setGraphUpdateTrigger] = useState(0);
  const [graphPosition, setGraphPosition] = useState({ x: 20, y: 20 });
  const [isDraggingGraph, setIsDraggingGraph] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [isGraphCollapsed, setIsGraphCollapsed] = useState(false);
  const [graphMode, setGraphMode] = useState<'timeSeries' | '2dPosition'>('timeSeries');
  const [showXAxis, setShowXAxis] = useState(true);
  const [showYAxis, setShowYAxis] = useState(true);
  const [showZAxis, setShowZAxis] = useState(false);
  const [poseError, setPoseError] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const videoAreaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphCanvasRef = useRef<HTMLCanvasElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const graphHistoryRef = useRef<{time: number, landmarks: {x: number, y: number, z: number}[]}[]>([]);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const analysisStartTimeRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  const [filters, setFilters] = useState<FilterState>({
    player_name: '',
    shot_type: '',
    date_from: '',
    date_to: '',
    tags: [],
    favorite: false
  });

  const playerNames = useMemo(() => {
    const names = players.map(p => `${p.first_name} ${p.last_name}`);
    return Array.from(new Set(names)).sort();
  }, [players]);

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
      document.body.removeChild(script1);
      document.body.removeChild(script2);
      document.body.removeChild(script3);
      document.body.removeChild(script4);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isAnalyzing) {
      graphHistoryRef.current = [];
      analysisStartTimeRef.current = 0;
      setGraphUpdateTrigger(0);
      if (videoPlayerRef.current) {
        videoPlayerRef.current.currentTime = 0;
        setCurrentTime(0);
        if (videoPlayerRef.current.paused) {
          videoPlayerRef.current.play();
          setIsPlaying(true);
        }
      }
    }
  }, [isAnalyzing]);

  useEffect(() => {
    let mounted = true;

    if (selectedVideo) {
      // Reset autoplay state
      setAutoplayBlocked(false);
      setIsPlaying(true);

      // Attempt to play video after it loads
      const attemptPlay = () => {
        if (videoPlayerRef.current && mounted) {
          const playPromise = videoPlayerRef.current.play();

          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                if (mounted) {
                  console.log('Video autoplay successful');
                  setAutoplayBlocked(false);
                  setIsPlaying(true);
                }
              })
              .catch((error) => {
                console.log('Autoplay blocked, showing play button:', error);
                if (mounted) {
                  setAutoplayBlocked(true);
                  setIsPlaying(false);
                }
              });
          }
        }
      };

      // Try to play after a short delay
      const playTimeout = setTimeout(attemptPlay, 200);

      if (window.Pose) {
        setPoseError(false);

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
          }
        } catch (error) {
          console.error('Failed to initialize MediaPipe Pose:', error);
          if (mounted) {
            poseRef.current = null;
            setPoseError(true);
          }
        }
      }

      return () => {
        mounted = false;
        clearTimeout(playTimeout);
        if (poseRef.current) {
          try {
            poseRef.current.close();
          } catch (error) {
            console.error('Error closing pose:', error);
          }
          poseRef.current = null;
        }
      };
    }
  }, [selectedVideo]);

  const loadTags = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('tags')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      setAllTags(data || []);
    } catch (error: any) {
      console.error('Failed to load tags', error);
    }
  };

  const loadVideos = async (append: boolean = false) => {
    if (!user) return;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setVideos([]);
    }
    setError(null);

    try {
      const startIndex = append ? videos.length : 0;
      const endIndex = startIndex + VIDEOS_PER_PAGE - 1;

      const { data: videosData, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('taken_at', { ascending: false })
        .range(startIndex, endIndex);

      if (fetchError) throw fetchError;

      if ((videosData || []).length < VIDEOS_PER_PAGE) {
        setHasMore(false);
      }

      if (videosData && videosData.length > 0) {
        const videoIds = videosData.map(v => v.id);

        const { data: videoTagsData } = await supabase
          .from('video_tags')
          .select('video_id, tag_id, tags(id, name, created_at)')
          .in('video_id', videoIds);

        const tagsByVideo = (videoTagsData || []).reduce((acc: any, vt: any) => {
          if (!acc[vt.video_id]) acc[vt.video_id] = [];
          if (vt.tags) acc[vt.video_id].push(vt.tags);
          return acc;
        }, {});

        const videosWithTags = videosData.map(video => ({
          ...video,
          tags: tagsByVideo[video.id] || []
        }));

        setVideos(prev => append ? [...prev, ...videosWithTags] : videosWithTags);
      } else if (!append) {
        setVideos([]);
        setHasMore(false);
      }
    } catch (error: any) {
      console.error('Failed to load videos', error);
      setError('Failed to load videos. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Depend on the id, not the user object - Supabase mints a new session
  // object (new `user` reference) on every token refresh, including the one
  // it runs automatically whenever a backgrounded tab regains focus.
  useEffect(() => {
    setHasMore(true);
    loadVideos(false);
    loadTags();
  }, [user?.id]);

  const loadMoreVideos = () => {
    if (!loadingMore && hasMore) {
      loadVideos(true);
    }
  };

  useEffect(() => {
    if (viewMode === 'timeline' && timelineScrollRef.current && videos.length > 0) {
      setTimeout(() => {
        if (timelineScrollRef.current) {
          timelineScrollRef.current.scrollLeft = timelineScrollRef.current.scrollWidth;
        }
      }, 100);
    }
  }, [viewMode, videos]);

  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      const matchesPlayer = filters.player_name
        ? video.player_name.toLowerCase().includes(filters.player_name.toLowerCase())
        : true;
      const matchesShot = filters.shot_type ? video.shot_type === filters.shot_type : true;
      const videoDate = new Date(video.taken_at).getTime();
      const matchesFrom = filters.date_from ? videoDate >= new Date(filters.date_from).getTime() : true;
      const matchesTo = filters.date_to ? videoDate <= new Date(filters.date_to).getTime() : true;
      const matchesFavorite = filters.favorite ? video.favorite : true;

      const matchesTags = filters.tags.length === 0 || filters.tags.every(filterTag =>
        video.tags?.some(tag => tag.name === filterTag)
      );

      return matchesPlayer && matchesShot && matchesFrom && matchesTo && matchesTags && matchesFavorite;
    });
  }, [videos, filters]);

  const sortedTimelineVideos = useMemo(() => {
    return [...filteredVideos].sort((a, b) =>
      new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()
    );
  }, [filteredVideos]);

  const handleFilterChange = (key: keyof FilterState, value: string | string[]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    trackFilterAction(key, value, 'videos_page');
  };

  const handleTagFilterToggle = (tagName: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tagName)
        ? prev.tags.filter(t => t !== tagName)
        : [...prev.tags, tagName]
    }));
  };

  const toggleFavorite = async (video: VideoRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;
    const newValue = !video.favorite;
    setVideos(prev => prev.map(v => v.id === video.id ? { ...v, favorite: newValue } : v));
    if (selectedVideo?.id === video.id) {
      setSelectedVideo(prev => prev ? { ...prev, favorite: newValue } : prev);
    }
    const { error } = await supabase
      .from('videos')
      .update({ favorite: newValue })
      .eq('id', video.id)
      .eq('user_id', user.id);
    if (error) {
      setVideos(prev => prev.map(v => v.id === video.id ? { ...v, favorite: !newValue } : v));
      if (selectedVideo?.id === video.id) {
        setSelectedVideo(prev => prev ? { ...prev, favorite: !newValue } : prev);
      }
      showAlert('Erreur lors de la mise à jour du favori', { type: 'error' });
    }
  };

  const handleDeleteVideo = async (video: VideoRecord) => {
    setDeleteConfirmVideo(video);
    trackVideoAction('delete', video.id, { initiated: true });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmVideo || !user) return;

    setIsDeleting(true);
    try {
      // Delete from S3 first
      const s3DeleteSuccess = await deleteVideoFromS3(deleteConfirmVideo.id);

      if (!s3DeleteSuccess) {
        console.error('Failed to delete video from S3');
        // Continue with database deletion even if S3 deletion fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('videos')
        .delete()
        .eq('id', deleteConfirmVideo.id)
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      await loadVideos();
      setDeleteConfirmVideo(null);
    } catch (error: any) {
      console.error('Failed to delete video', error);
      showAlert('Failed to delete video. Please try again.', { type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true
      });
      setStream(mediaStream);
      if (videoRecorderRef.current) {
        videoRecorderRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      showAlert('Could not access camera. Please check permissions.', { type: 'error' });
    }
  };

  const startRecording = useCallback(() => {
    if (!stream) return;

    setRecordedChunks([]);
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        setRecordedChunks((prev) => [...prev, event.data]);
      }
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);

    setTimer(0);
    timerRef.current = window.setInterval(() => {
      setTimer(t => t + 1);
    }, 1000);
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  const handleRetake = () => {
    setRecordedChunks([]);
    setTimer(0);
    if (videoRecorderRef.current && stream) {
      videoRecorderRef.current.srcObject = stream;
      videoRecorderRef.current.play();
    }
  };

  const handleUseRecording = () => {
    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: 'video/mp4' });
    const now = new Date();
    const filename = `recording-${Date.now()}.mp4`;
    const file = new File([blob], filename, { type: 'video/mp4' });
    setFile(file);

    // Set current date/time for recorded videos
    setTakenAt(now.toISOString().substring(0, 16));

    setMode('details');
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (mode === 'record' && !stream) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mode]);

  useEffect(() => {
    const isReviewing = !isRecording && recordedChunks.length > 0;
    if (isReviewing && videoRecorderRef.current) {
      const blob = new Blob(recordedChunks, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      videoRecorderRef.current.srcObject = null;
      videoRecorderRef.current.src = url;
      videoRecorderRef.current.controls = true;
      videoRecorderRef.current.play();
    } else if (!isReviewing && videoRecorderRef.current && stream) {
      videoRecorderRef.current.srcObject = stream;
      videoRecorderRef.current.controls = false;
      videoRecorderRef.current.muted = true;
      videoRecorderRef.current.play();
    }
  }, [isRecording, recordedChunks, stream]);

  const extractDateFromFilename = (filename: string): string | null => {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    // Pattern 1: VID-20260221-WA0000 (VID-YYYYMMDD-...)
    const vidPattern = /VID[_-](\d{8})/i;
    const vidMatch = nameWithoutExt.match(vidPattern);
    if (vidMatch) {
      const dateStr = vidMatch[1];
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${year}-${month}-${day}T12:00`;
    }

    // Pattern 2: YYYYMMDD_HHMMSS or prefix_YYYYMMDD_HHMMSS (6-digit time)
    const dateTimePattern = /(?:^|[_-])(\d{8})[_-](\d{6})(?:[_-]|$)/;
    const dateTimeMatch = nameWithoutExt.match(dateTimePattern);
    if (dateTimeMatch) {
      const dateStr = dateTimeMatch[1];
      const timeStr = dateTimeMatch[2];
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const hour = timeStr.substring(0, 2);
      const minute = timeStr.substring(2, 4);
      return `${year}-${month}-${day}T${hour}:${minute}`;
    }

    // Pattern 3: YYYYMMDD-HHMM or YYYYMMDD_HHMM (4-digit time, mobile pattern)
    const dateTimeShortPattern = /(?:^|[_-])(\d{8})[_-](\d{4})(?:[_-]|$)/;
    const dateTimeShortMatch = nameWithoutExt.match(dateTimeShortPattern);
    if (dateTimeShortMatch) {
      const dateStr = dateTimeShortMatch[1];
      const timeStr = dateTimeShortMatch[2];
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6));
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(timeStr.substring(0, 2));
      const minute = parseInt(timeStr.substring(2, 4));
      if (year >= 2000 && year <= 2099 && month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour <= 23 && minute <= 59) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}`;
      }
    }

    // Pattern 4: Just date YYYYMMDD anywhere in filename
    const dateOnlyPattern = /(\d{8})/;
    const dateOnlyMatch = nameWithoutExt.match(dateOnlyPattern);
    if (dateOnlyMatch) {
      const dateStr = dateOnlyMatch[1];
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6));
      const day = parseInt(dateStr.substring(6, 8));

      if (year >= 2000 && year <= 2099 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T12:00`;
      }
    }

    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const now = new Date();
      let finalDate: string;

      const extractedDate = extractDateFromFilename(selectedFile.name);

      if (isMobile) {
        // On mobile, lastModified is unreliable — always prefer filename parsing
        finalDate = extractedDate ?? now.toISOString().substring(0, 16);
      } else {
        // On desktop, filename takes priority, then lastModified
        if (extractedDate) {
          finalDate = extractedDate;
        } else {
          const fileDate = new Date(selectedFile.lastModified);
          const timeDiff = Math.abs(now.getTime() - fileDate.getTime());
          finalDate = timeDiff > 60000
            ? fileDate.toISOString().substring(0, 16)
            : now.toISOString().substring(0, 16);
        }
      }

      setTakenAt(finalDate);
      setMode('details');
    }
  };

  const handleAddNewTag = async () => {
    const trimmedTag = newTagInput.trim().toLowerCase();
    if (!trimmedTag) return;

    const existingTag = allTags.find(t => t.name.toLowerCase() === trimmedTag);
    if (existingTag) {
      if (!selectedTags.includes(existingTag.name)) {
        setSelectedTags([...selectedTags, existingTag.name]);
      }
    } else {
      setSelectedTags([...selectedTags, trimmedTag]);
      setAllTags([...allTags, { id: 'temp-' + Date.now(), name: trimmedTag, created_at: new Date().toISOString() }]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagName: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tagName));
  };

  const handleCloseModal = () => {
    setIsUploadModalOpen(false);
    setMode('select');
    setFile(null);
    setPlayerName('');
    setShotType('Forehand');
    setTakenAt(new Date().toISOString().substring(0, 16));
    setSelectedTags([]);
    setNewTagInput('');
    setMatchId('');
    setStatus('idle');
    setErrorMessage('');
    setRecordedChunks([]);
  };

  const uploadVideo = async () => {
    if (!file || !user) return;

    if (!canUploadVideo) {
      setStatus('error');
      setErrorMessage(`You've reached your ${limits.maxVideos} video upload limit on the Free plan. Upgrade to Premium for unlimited uploads!`);
      return;
    }

    setStatus('uploading');
    setUploadProgress(0);
    setErrorMessage('');
    trackVideoAction('upload', undefined, { file_size: file.size, file_type: file.type });

    try {
      const durationSeconds = await getVideoDuration(file);

      if (durationSeconds !== null && durationSeconds > limits.maxVideoDurationSeconds) {
        setStatus('error');
        setErrorMessage(`Videos must be ${limits.maxVideoDurationSeconds} seconds or less.`);
        return;
      }

      if (!hasVideoStorageRoom(file.size)) {
        setStatus('error');
        setErrorMessage("You've reached your 1GB video storage limit on the Premium plan.");
        return;
      }

      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const uniqueId = crypto.randomUUID();
      const fileName = `${uniqueId}-${timestamp}.${fileExt}`;

      let s3ErrorMessage = '';
      const s3Result = await uploadVideoToS3(
        file,
        fileName,
        (pct) => setUploadProgress(pct),
        (message) => { s3ErrorMessage = message; }
      );

      if (!s3Result) {
        throw new Error(s3ErrorMessage || 'Failed to upload video to S3');
      }

      // Use the presigned URL from S3, pointing at the transcoded-output prefix
      const videoUrl = toFinalVideoUrl(s3Result.presignedUrl);

      // Create poster image URL by replacing .mp4 with .jpg
      const posterImageUrl = videoUrl.replace(/\.(mp4|webm|mov|avi)$/i, '.jpg');

      const { data: videoData, error: dbError } = await supabase
        .from('videos')
        .insert([{
          user_id: user.id,
          url: videoUrl,
          player_name: playerName,
          shot_type: shotType,
          taken_at: new Date(takenAt).toISOString(),
          poster_image: posterImageUrl,
          status: 'completed',
          size_bytes: file.size,
          duration_seconds: durationSeconds,
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      await incrementUsage('video', { bytes: file.size });

      for (const tagName of selectedTags) {
        let tagId = allTags.find(t => t.name === tagName)?.id;

        if (!tagId || tagId.startsWith('temp-')) {
          const { data: newTag, error: tagError } = await supabase
            .from('tags')
            .insert([{ name: tagName }])
            .select()
            .single();

          if (tagError) {
            if (tagError.code === '23505') {
              const { data: existingTag } = await supabase
                .from('tags')
                .select('*')
                .eq('name', tagName)
                .single();
              tagId = existingTag?.id;
            } else {
              throw tagError;
            }
          } else {
            tagId = newTag.id;
          }
        }

        if (tagId) {
          await supabase
            .from('video_tags')
            .insert([{
              video_id: videoData.id,
              tag_id: tagId
            }]);
        }
      }

      setStatus('success');
      setTimeout(() => {
        loadVideos();
        loadTags();
        handleCloseModal();
      }, 2000);
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to upload video. Check your connection or permissions.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const drawGraph = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const history = graphHistoryRef.current;
    ctx.clearRect(0, 0, width, height);

    if (graphMode === '2dPosition') {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      if (history.length === 0) return;

      const landmarkData = history
        .filter(h => h.landmarks[selectedLandmarkId])
        .map(h => ({
          x: h.landmarks[selectedLandmarkId].x,
          y: h.landmarks[selectedLandmarkId].y
        }));

      if (landmarkData.length === 0) return;

      ctx.fillStyle = '#ec4899';
      landmarkData.forEach((point) => {
        const x = point.x * width;
        const y = point.y * height;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, 2 * Math.PI);
        ctx.fill();
      });
    } else {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (history.length === 0) return;

      const sortedHistory = [...history].sort((a, b) => a.time - b.time);
      const maxTime = sortedHistory[sortedHistory.length - 1].time || 0.1;

      if (maxTime > 0) {
        const timeX = width;
        ctx.strokeStyle = '#94a3b8';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(timeX, 0);
        ctx.lineTo(timeX, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const landmarkData = sortedHistory
        .filter(h => h.landmarks[selectedLandmarkId])
        .map(h => ({
          time: h.time,
          x: h.landmarks[selectedLandmarkId].x,
          y: h.landmarks[selectedLandmarkId].y,
          z: h.landmarks[selectedLandmarkId].z
        }));

      if (landmarkData.length === 0) return;

      const drawLine = (getColor: string, getValue: (p: {x: number, y: number, z: number}) => number) => {
        ctx.beginPath();
        ctx.strokeStyle = getColor;
        ctx.lineWidth = 2;
        let started = false;

        landmarkData.forEach((point) => {
          const x = (point.time / maxTime) * width;
          const val = getValue(point);
          const y = val * height;

          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      };

      if (showXAxis) drawLine('#f87171', p => p.x);
      if (showYAxis) drawLine('#60a5fa', p => p.y);
      if (showZAxis) drawLine('#4ade80', p => Math.abs(p.z));
    }
  };

  const onResults = (results: any) => {
    const canvas = canvasRef.current;
    const video = videoPlayerRef.current;

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
          window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS,
            {color: '#00ff00', lineWidth: 4});
        }
        if (window.drawLandmarks) {
          window.drawLandmarks(ctx, results.poseLandmarks,
            {color: '#ff0000', lineWidth: 2, radius: 6});

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
      const currentTime = video.currentTime;
      const history = graphHistoryRef.current;
      const lastPoint = history[history.length - 1];

      if (!lastPoint || Math.abs(lastPoint.time - currentTime) > 0.05) {
        const landmarks = results.poseLandmarks.map((landmark: any) => ({
          x: landmark.x,
          y: landmark.y,
          z: landmark.z
        }));

        history.push({
          time: currentTime,
          landmarks: landmarks
        });

        setGraphUpdateTrigger(prev => prev + 1);
      }
    }
  };

  useEffect(() => {
    let errorCount = 0;
    const maxErrors = 5;

    const processFrame = async () => {
      if (poseError || errorCount >= maxErrors) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }

      if (isAnalyzing && videoPlayerRef.current && !videoPlayerRef.current.paused && !videoPlayerRef.current.ended && poseRef.current) {
        try {
          await poseRef.current.send({image: videoPlayerRef.current});
          errorCount = 0;
        } catch (error) {
          errorCount++;
          if (errorCount >= maxErrors) {
            console.error('MediaPipe error limit reached. Stopping pose detection.');
            setPoseError(true);
            setIsAnalyzing(false);
          }
        }
      }

      if (isAnalyzing && !poseError && errorCount < maxErrors) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    if (isAnalyzing && !poseError) {
      errorCount = 0;
      processFrame();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnalyzing, isPlaying, poseError]);

  const handleTimeUpdate = () => {
    if (videoPlayerRef.current) {
      const newTime = videoPlayerRef.current.currentTime;
      setCurrentTime(newTime);
      previousTimeRef.current = newTime;
      if (graphCanvasRef.current && isAnalyzing) {
        const gCtx = graphCanvasRef.current.getContext('2d');
        if (gCtx) drawGraph(gCtx, graphCanvasRef.current.width, graphCanvasRef.current.height);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoPlayerRef.current) {
      setDuration(videoPlayerRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);

    if (playlistMode) {
      const nextIndex = currentPlaylistIndex + 1;
      if (nextIndex < sortedTimelineVideos.length) {
        setCurrentPlaylistIndex(nextIndex);
        setSelectedVideo(sortedTimelineVideos[nextIndex]);
      } else {
        setPlaylistMode(false);
        setCurrentPlaylistIndex(0);
      }
    }
  };

  const togglePlay = () => {
    if (videoPlayerRef.current) {
      if (videoPlayerRef.current.paused) {
        const playPromise = videoPlayerRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              setAutoplayBlocked(false);
            })
            .catch((error) => {
              console.error('Play failed:', error);
              setAutoplayBlocked(true);
              setIsPlaying(false);
            });
        }
      } else {
        videoPlayerRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleFullscreen = () => {
    // Fullscreen the video area itself, not the whole modal card - the
    // modal has its own padding/border/rounded corners, which stayed
    // visible around the edges when those were what went fullscreen.
    const videoContainer = videoAreaRef.current;
    if (!videoContainer) return;

    if (!document.fullscreenElement) {
      videoContainer.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => setShowControls(false), 2000);
  }, []);

  useEffect(() => {
    if (!selectedVideo) return;
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [selectedVideo, resetControlsTimer]);

  // The video player is a modal but isn't at the top of the DOM tree, so it
  // doesn't get the same scroll containment the rest of the page's overlays
  // rely on - lock the body explicitly while it's open.
  useEffect(() => {
    if (!selectedVideo) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selectedVideo]);

  const handleSeek = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoPlayerRef.current) {
      const isMovingForward = time > previousTimeRef.current;
      videoPlayerRef.current.currentTime = time;
      setCurrentTime(time);
      previousTimeRef.current = time;

      // If moving forward and analyze is enabled, trigger frame step twice (2 frames forward)
      if (isMovingForward && isAnalyzing) {
        await frameStep('forward');
        await frameStep('forward');
      }
    }
  };

  const frameStep = async (direction: 'forward' | 'backward') => {
    if (!videoPlayerRef.current) return;

    const fps = 30;
    const frameDuration = 1 / fps;
    const newTime = direction === 'forward'
      ? Math.min(videoPlayerRef.current.currentTime + frameDuration, duration)
      : Math.max(videoPlayerRef.current.currentTime - frameDuration, 0);

    videoPlayerRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    previousTimeRef.current = newTime;

    if (videoPlayerRef.current.paused === false) {
      videoPlayerRef.current.pause();
      setIsPlaying(false);
    }

    // Trigger pose estimation for the current frame when stepping
    if (isAnalyzing && poseRef.current && videoPlayerRef.current) {
      try {
        await poseRef.current.send({image: videoPlayerRef.current});
      } catch (error) {
        console.error('Pose estimation error during frame step:', error);
      }
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
      if (ctx) {
        drawGraph(ctx, graphCanvasRef.current.width, graphCanvasRef.current.height);
      }
    }
  }, [selectedLandmarkId, isAnalyzing, graphUpdateTrigger, graphMode, showXAxis, showYAxis, showZAxis]);

  const handleGraphTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDraggingGraph(true);
    setDragStartPos({
      x: touch.clientX - graphPosition.x,
      y: touch.clientY - graphPosition.y
    });
  };

  const handleGraphTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingGraph) return;
    e.preventDefault();
    const touch = e.touches[0];
    const newX = touch.clientX - dragStartPos.x;
    const newY = touch.clientY - dragStartPos.y;

    const maxX = window.innerWidth - (graphContainerRef.current?.offsetWidth || 240);
    const maxY = window.innerHeight - (graphContainerRef.current?.offsetHeight || 300);

    setGraphPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleGraphTouchEnd = () => {
    setIsDraggingGraph(false);
  };

  const handleGraphMouseDown = (e: React.MouseEvent) => {
    setIsDraggingGraph(true);
    setDragStartPos({
      x: e.clientX - graphPosition.x,
      y: e.clientY - graphPosition.y
    });
  };

  const handleGraphMouseMove = (e: MouseEvent) => {
    if (!isDraggingGraph) return;
    const newX = e.clientX - dragStartPos.x;
    const newY = e.clientY - dragStartPos.y;

    const maxX = window.innerWidth - (graphContainerRef.current?.offsetWidth || 240);
    const maxY = window.innerHeight - (graphContainerRef.current?.offsetHeight || 300);

    setGraphPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleGraphMouseUp = () => {
    setIsDraggingGraph(false);
  };

  useEffect(() => {
    if (isDraggingGraph) {
      window.addEventListener('mousemove', handleGraphMouseMove);
      window.addEventListener('mouseup', handleGraphMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGraphMouseMove);
        window.removeEventListener('mouseup', handleGraphMouseUp);
      };
    }
  }, [isDraggingGraph, dragStartPos, graphPosition]);

  useEffect(() => {
    if (!selectedVideo) return;

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
  }, [selectedVideo, duration]);

  const handleDownloadVideo = async (videoUrl: string) => {
    if (isDownloadingVideo) return;
    setIsDownloadingVideo(true);
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
      window.open(videoUrl, '_blank');
    } finally {
      setIsDownloadingVideo(false);
    }
  };

  const closeVideoPlayer = () => {
    setSelectedVideo(null);
    setIsAnalyzing(false);
    graphHistoryRef.current = [];
    setGraphUpdateTrigger(0);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
    setIsGraphCollapsed(false);
    setPlaylistMode(false);
    setCurrentPlaylistIndex(0);
    setAutoplayBlocked(false);
  };

  const isReviewing = !isRecording && recordedChunks.length > 0;

  return (
    <>
      <AlertComponent />
      <div className="min-h-screen bg-black text-white relative">
        <CourtBackground opacity={0.4} />

        {/* Hero Section */}
        <section className="relative pt-16 pb-8 lg:pt-20 lg:pb-12 overflow-hidden z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-[#050d1a] via-[#071428]/30 to-[#050d1a]" />

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[600px] h-[300px] bg-[#1A6FC4]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[400px] bg-[#C8F135]/5 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
            <div className="flex items-center gap-2 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-video w-5 h-5 text-[#C8F135]"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect></svg>
              <span className="text-[#C8F135] text-sm font-medium tracking-widest uppercase">
                Video Library
              </span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6">
              Your Tennis<br />
              <span className="text-[#C8F135]">Videos</span>
            </h1>

            <p className="text-lg text-gray-300 max-w-2xl leading-relaxed">
              Record, analyze, and improve your game with advanced video tools
            </p>
          </div>
        </section>

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-end gap-2 md:gap-3 flex-shrink-0 overflow-x-auto">
            <div className="bg-white/5 p-1 rounded-lg flex border border-white/10 flex-shrink-0">
              <button
                onClick={() => {
                  setViewMode('list');
                  trackButtonClick('view_mode_list', 'videos_page');
                }}
                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-[#C8F135] text-black shadow' : 'text-white/60 hover:text-white'}`}
                title="List View"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => {
                  setViewMode('timeline');
                  trackButtonClick('view_mode_timeline', 'videos_page');
                }}
                className={`p-2 rounded-md transition-all ${viewMode === 'timeline' ? 'bg-[#C8F135] text-black shadow' : 'text-white/60 hover:text-white'}`}
                title="Timeline View"
              >
                <ListIcon size={18} className="rotate-90" />
              </button>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-lg border border-white/10 transition-colors flex-shrink-0 ${showFilters ? 'bg-white/10 text-white' : 'bg-white/5 text-white/60 hover:text-white'}`}
              title="Filters"
            >
              <Filter size={20} />
            </button>

            <button
              onClick={() => window.location.href = '/video-editor'}
              disabled
              className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white/5 text-white/30 rounded-lg font-medium border border-white/5 cursor-not-allowed opacity-50"
            >
              <Edit size={20} />
              <span className="hidden lg:inline">Video Editor</span>
            </button>

            <button
              onClick={() => {
                const next = !showMatchAnalysis;
                setShowMatchAnalysis(next);
                if (!next) { setHasMore(true); loadVideos(false); }
              }}
              className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 text-white rounded-lg font-medium transition-all border ${
                showMatchAnalysis
                  ? 'bg-[#C8F135] text-black border-[#C8F135] shadow-lg shadow-[#C8F135]/30 scale-95'
                  : 'bg-white/5 hover:bg-white/10 border-white/10'
              }`}
            >
              <BarChart3 size={18} className="md:w-5 md:h-5" />
              <span className="hidden sm:inline">Match Analysis</span>
            </button>

            <button
              onClick={() => {
                setIsUploadModalOpen(true);
                trackButtonClick('add_video', 'videos_page');
              }}
              className="flex items-center gap-2 px-3 md:px-4 py-2.5 bg-[#C8F135] hover:bg-[#d4f54a] text-black rounded-lg font-bold transition-all shadow-lg flex-shrink-0"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Ajouter</span>
            </button>
        </div>

        {showFilters && (
          <div className="border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <select
                  value={filters.player_name}
                  onChange={(e) => handleFilterChange('player_name', e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                >
                  <option value="" class="bg-[#0a1628] text-gray-300">Tous les joueurs</option>
                  {playerNames.map((name) => (
                    <option key={name} value={name} class="bg-[#0a1628] text-gray-300">{name}</option>
                  ))}
                </select>
                <select
                  value={filters.shot_type}
                  onChange={(e) => handleFilterChange('shot_type', e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                >
                  <option value="" class="bg-[#0a1628] text-gray-300">Tous les coups</option>
                  <option value="Forehand" class="bg-[#0a1628] text-gray-300">Coup droit</option>
                  <option value="Backhand" class="bg-[#0a1628] text-gray-300">Revers</option>
                  <option value="Serve" class="bg-[#0a1628] text-gray-300">Service</option>
                  <option value="Volley" class="bg-[#0a1628] text-gray-300">Volée</option>
                  <option value="Smash" class="bg-[#0a1628] text-gray-300">Smash</option>
                </select>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Date de début</label>
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-[#C8F135] outline-none [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Date de fin</label>
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-[#C8F135] outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label
                  className="flex items-center gap-2.5 cursor-pointer select-none group"
                  onClick={() => setFilters(prev => ({ ...prev, favorite: !prev.favorite }))}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    filters.favorite
                      ? 'bg-[#C8F135] border-[#C8F135]'
                      : 'border-white/20 group-hover:border-white/40'
                  }`}>
                    {filters.favorite && <Star size={12} className="text-black fill-current" />}
                  </div>
                  <span className={`text-sm font-medium transition-colors ${
                    filters.favorite ? 'text-[#C8F135]' : 'text-white/60 group-hover:text-white/80'
                  }`}>
                    Favoris uniquement
                  </span>
                </label>
              </div>

              {allTags.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 block">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleTagFilterToggle(tag.name)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          filters.tags.includes(tag.name)
                            ? 'bg-[#C8F135] text-black'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 relative z-10">
        {showMatchAnalysis ? (
          <MatchAnalysisPage onClose={() => { setShowMatchAnalysis(false); setHasMore(true); loadVideos(false); }} inline={true} />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-8 h-8 border-4 border-[#C8F135] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-white/50 animate-pulse">Chargement des vidéos...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-96 gap-6 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <AlertCircle className="text-red-500" size={40} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Erreur de connexion</h3>
              <p className="text-white/60 max-w-md mx-auto">{error}</p>
            </div>
            <button
              onClick={loadVideos}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              <RefreshCw size={18} />
              Réessayer
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-white/60 text-sm">
                {filteredVideos.length} {filteredVideos.length === 1 ? 'vidéo' : 'vidéos'}
              </div>

              {viewMode === 'timeline' && filteredVideos.length > 0 && (
                <button
                  onClick={() => {
                    setCurrentPlaylistIndex(0);
                    setPlaylistMode(true);
                    setSelectedVideo(sortedTimelineVideos[0]);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#C8F135] hover:bg-[#d4f54a] text-black rounded-lg font-bold transition-all shadow-lg"
                >
                  <PlayCircle size={20} />
                  Play All
                </button>
              )}

              <div className="text-white/60 text-sm opacity-0">
                {filteredVideos.length} {filteredVideos.length === 1 ? 'vidéo' : 'vidéos'}
              </div>
            </div>

            {filteredVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-white/50">
                <VideoIcon className="w-16 h-16 mb-4 text-white/30" />
                <p>Aucune vidéo trouvée</p>
              </div>
            ) : viewMode === 'list' ? (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-4 pb-20">
                  {filteredVideos.map((video) => (
                    <div
                      key={video.id}
                      className="bg-white/5 rounded-xl overflow-hidden shadow-lg border border-white/10 hover:border-[#C8F135] transition-all group"
                    >
                      <div className="relative aspect-video bg-black/25 cursor-pointer" onClick={() => setSelectedVideo(video)}>
                        <img
                          src={video.poster_image || '/logo.svg'}
                          alt={video.player_name}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/logo.svg';
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-[#C8F135] group-hover:scale-110 transition-all">
                            <Play className="text-white group-hover:text-black ml-0.5 sm:ml-1 w-4 h-4 sm:w-6 sm:h-6" />
                          </div>
                        </div>
                        <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-black/60 px-1 py-0.5 sm:px-2 rounded text-[10px] sm:text-xs text-white">
                          {new Date(video.taken_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-[#C8F135] px-1 py-0.5 sm:px-2 rounded text-[9px] sm:text-xs font-bold text-black uppercase tracking-wider">
                          {video.shot_type}
                        </div>
                        <button
                          onClick={(e) => toggleFavorite(video, e)}
                          className={`absolute bottom-1 left-1 sm:bottom-2 sm:left-2 p-1 sm:p-1.5 rounded-full transition-all z-10 ${
                            video.favorite
                              ? 'bg-[#C8F135]/90 text-black'
                              : 'bg-black/50 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/70'
                          }`}
                          title={video.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        >
                          <Star size={14} className={`sm:w-4 sm:h-4 ${video.favorite ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVideo(video);
                          }}
                          className="absolute top-1 right-1 sm:top-2 sm:right-2 p-1 sm:p-2 bg-red-600/80 hover:bg-red-600 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                          title="Supprimer"
                        >
                          <Trash2 size={14} className="text-white sm:w-4 sm:h-4" />
                        </button>
                      </div>
                      <div className="p-2 sm:p-3">
                        <h3 className="font-semibold text-white truncate text-xs sm:text-base">{video.player_name}</h3>
                        <p className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1 hidden sm:block">
                          Ajouté: {new Date(video.created_at).toLocaleDateString()}
                        </p>
                        {video.tags && video.tags.length > 0 && (
                          <div className="hidden sm:flex flex-wrap gap-1 mt-2">
                            {video.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="px-2 py-0.5 bg-white/10 text-white/80 rounded-full text-xs flex items-center gap-1"
                              >
                                <TagIcon size={10} />
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {hasMore && !loading && (
                  <div className="flex justify-center py-8">
                    <button
                      onClick={loadMoreVideos}
                      disabled={loadingMore}
                      className="px-6 py-3 bg-[#C8F135] hover:bg-[#d4f54a] text-black rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="animate-spin" size={20} />
                          Chargement...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={20} />
                          Charger plus
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="h-[calc(100vh-300px)] flex flex-col justify-center relative overflow-hidden py-10">
                <div
                  ref={timelineScrollRef}
                  className="flex overflow-x-auto items-center px-10 pb-12 pt-8 space-x-12 min-h-[400px]"
                  style={{ scrollBehavior: 'smooth', scrollbarWidth: 'thin' }}
                >
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-white/20 -z-10 transform -translate-y-1/2"
                    style={{ width: `${sortedTimelineVideos.length * 320}px` }}
                  />

                  {sortedTimelineVideos.map((video, index) => {
                    const date = new Date(video.taken_at);
                    const isTop = index % 2 === 0;

                    return (
                      <div key={video.id} className="relative flex-shrink-0 group">
                        <div className={`absolute left-1/2 w-0.5 bg-white/30 -translate-x-1/2 z-0
                            ${isTop ? 'bottom-full h-8 mb-2' : 'top-full h-8 mt-2'}
                        `}></div>

                        <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-black border-2 border-[#C8F135] rounded-full -translate-x-1/2 -translate-y-1/2 z-10 group-hover:scale-125 transition-transform"></div>

                        <div
                          onClick={() => setSelectedVideo(video)}
                          className={`w-64 bg-white/5 rounded-lg p-2 border border-white/10 shadow-xl cursor-pointer hover:border-[#C8F135] transition-all hover:scale-105 z-20
                            ${isTop ? 'mb-10' : 'mt-10'}
                          `}
                        >
                           <div className="relative aspect-video rounded bg-black/50 mb-2 overflow-hidden">
                             <img
                               src={video.poster_image || '/logo.svg'}
                               alt={video.player_name}
                               className="w-full h-full object-cover"
                               onError={(e) => {
                                 const target = e.target as HTMLImageElement;
                                 target.src = '/logo.svg';
                               }}
                             />
                             <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-transparent transition-colors">
                                <PlayCircle className="text-white/80" size={32} />
                             </div>
                           </div>

                           <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleFavorite(video, e); }}
                                  className={`p-0.5 rounded transition-colors shrink-0 ${
                                    video.favorite ? 'text-[#C8F135]' : 'text-slate-500 hover:text-white'
                                  }`}
                                >
                                  <Star size={14} className={video.favorite ? 'fill-current' : ''} />
                                </button>
                                <div>
                                  <p className="font-bold text-white text-sm">{video.player_name}</p>
                                  <p className="text-[#C8F135] text-xs font-semibold">{video.shot_type}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                  <p className="text-xs text-slate-400">{date.toLocaleDateString()}</p>
                                  <p className="text-[10px] text-slate-500">{date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                              </div>
                           </div>
                           {video.tags && video.tags.length > 0 && (
                             <div className="flex flex-wrap gap-1">
                               {video.tags.map((tag) => (
                                 <span
                                   key={tag.id}
                                   className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-0.5"
                                 >
                                   <TagIcon size={8} />
                                   {tag.name}
                                 </span>
                               ))}
                             </div>
                           )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="w-12 flex-shrink-0"></div>
                </div>

                <div className="absolute bottom-4 right-4 text-xs text-slate-500">
                  Scroll horizontally &larr; &rarr;
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {deleteConfirmVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
                  <AlertCircle className="text-red-500" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Confirmer la suppression</h3>
                  <p className="text-sm text-slate-400">Cette action est irréversible</p>
                </div>
              </div>

              <p className="text-slate-300">
                Êtes-vous sûr de vouloir supprimer cette vidéo de <span className="font-semibold text-white">{deleteConfirmVideo.player_name}</span> ?
              </p>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setDeleteConfirmVideo(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Supprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          {mode === 'record' ? (
            <div className="w-full max-w-4xl bg-[#0a1628] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[90vh] border border-white/10">
              <div className="flex-1 relative bg-black flex items-center justify-center">
                <video
                  ref={videoRecorderRef}
                  autoPlay
                  playsInline
                  muted={!isReviewing}
                  className="max-h-full max-w-full object-contain"
                />
                {isRecording && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/80 text-white px-3 py-1 rounded-full text-sm font-mono animate-pulse flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    {formatTime(timer)}
                  </div>
                )}
              </div>
              <div className="p-6 bg-black/80 border-t border-white/10 flex items-center justify-center gap-6">
                {isReviewing ? (
                  <>
                    <button onClick={handleRetake} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
                      <RefreshCw size={18} />
                      Recommencer
                    </button>
                    <button onClick={handleUseRecording} className="flex items-center gap-2 px-6 py-2 bg-[#C8F135] hover:bg-[#d4f54a] text-black rounded-lg font-bold transition-colors">
                      <Upload size={18} />
                      Utiliser
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setMode('select'); if (stream) stream.getTracks().forEach(t => t.stop()); setStream(null); }} className="absolute left-6 text-white/60 hover:text-white">
                      Annuler
                    </button>
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-red-500 hover:bg-red-600 transition-all hover:scale-105"
                      >
                        <Camera className="text-white" size={32} />
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-transparent hover:bg-white/10 transition-all"
                      >
                        <div className="w-6 h-6 bg-red-500 rounded-sm"></div>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#0a1628] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col relative max-h-[90vh]">
              {status === 'idle' && (
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <VideoIcon className="text-[#C8F135]" size={20} />
                    Ajouter Vidéo
                  </h2>
                  <button onClick={handleCloseModal} className="text-white/60 hover:text-white transition-colors">
                    <X />
                  </button>
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col justify-center overflow-y-auto">
                {status === 'uploading' && (
                  <div className="flex flex-col items-center justify-center text-center py-8 space-y-6">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-white/20 rounded-full"></div>
                      <div className="w-16 h-16 border-4 border-[#C8F135] border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                      <Upload className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white animate-pulse" size={24} />
                    </div>
                    <div className="w-full max-w-xs space-y-2">
                      <h3 className="text-lg font-semibold text-white">Téléchargement...</h3>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 bg-[#C8F135] rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-white/60">{uploadProgress}%</p>
                    </div>
                  </div>
                )}

                {status === 'success' && (
                  <div className="flex flex-col items-center justify-center text-center py-8 space-y-6">
                    <div className="w-20 h-20 bg-[#C8F135]/10 rounded-full flex items-center justify-center border-2 border-[#C8F135]">
                      <CheckCircle2 className="text-[#C8F135] w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Téléchargement terminé!</h3>
                      <p className="text-sm text-white/60 mt-1">Votre vidéo a été enregistrée.</p>
                    </div>
                  </div>
                )}

                {status === 'error' && (
                  <div className="flex flex-col items-center justify-center text-center py-8 space-y-6">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500">
                      <AlertCircle className="text-red-500 w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Échec du téléchargement</h3>
                      <p className="text-sm text-red-400 mt-2 bg-red-950/30 p-3 rounded-lg border border-red-900/50">
                        {errorMessage}
                      </p>
                    </div>
                    <div className="flex gap-3 w-full">
                      <button onClick={handleCloseModal} className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
                        Fermer
                      </button>
                      <button onClick={() => setStatus('idle')} className="flex-1 px-4 py-2 bg-[#C8F135] hover:bg-[#d4f54a] text-black font-bold rounded-lg transition-colors">
                        Réessayer
                      </button>
                    </div>
                  </div>
                )}

                {status === 'idle' && (
                  <>
                    {mode === 'select' && (
                      <div className="grid grid-cols-2 gap-4 h-full">
                        <button
                          onClick={() => setMode('record')}
                          className="flex flex-col items-center justify-center gap-4 p-6 bg-white/5 hover:bg-white/10 rounded-xl border-2 border-dashed border-white/20 hover:border-[#C8F135] transition-all group"
                        >
                          <div className="w-14 h-14 rounded-full bg-white/10 group-hover:bg-[#C8F135]/20 flex items-center justify-center transition-colors">
                            <Camera className="text-white/60 group-hover:text-[#C8F135]" size={28} />
                          </div>
                          <span className="font-medium text-white/60 group-hover:text-white">Enregistrer</span>
                        </button>

                        <label className="flex flex-col items-center justify-center gap-4 p-6 bg-white/5 hover:bg-white/10 rounded-xl border-2 border-dashed border-white/20 hover:border-[#C8F135] transition-all group cursor-pointer">
                          <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
                          <div className="w-14 h-14 rounded-full bg-white/10 group-hover:bg-[#C8F135]/20 flex items-center justify-center transition-colors">
                            <Upload className="text-white/60 group-hover:text-[#C8F135]" size={28} />
                          </div>
                          <span className="font-medium text-white/60 group-hover:text-white">Importer</span>
                        </label>
                      </div>
                    )}

                    {mode === 'details' && (
                      <form onSubmit={(e) => { e.preventDefault(); uploadVideo(); }} className="space-y-5">
                        {file && (
                          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                              <VideoIcon size={20} className="text-[#C8F135]" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-sm font-medium text-white truncate">{file.name}</p>
                              <p className="text-xs text-white/60">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setFile(null); setMode('select'); }}
                              className="ml-auto text-white/50 hover:text-red-400"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Nom du joueur</label>
                          <select
                            required
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                          >
                            <option value="" class="bg-[#0a1628] text-gray-300">Sélectionner un joueur</option>
                            {playerNames.map((name) => (
                              <option key={name} value={name} class="bg-[#0a1628] text-gray-300">{name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Match ID (optionnel)</label>
                          <input
                            type="text"
                            value={matchId}
                            onChange={(e) => setMatchId(e.target.value)}
                            placeholder="Entrer un Match ID"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-[#C8F135] focus:outline-none placeholder:text-white/40"
                          />
                          <p className="text-xs text-white/50 mt-1">Si vide, utilisera votre ID utilisateur</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Type de coup</label>
                            <select
                              value={shotType}
                              onChange={(e) => setShotType(e.target.value as ShotType)}
                              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                            >
                              <option value="Forehand" class="bg-[#0a1628] text-gray-300">Coup droit</option>
                              <option value="Backhand" class="bg-[#0a1628] text-gray-300">Revers</option>
                              <option value="Serve" class="bg-[#0a1628] text-gray-300">Service</option>
                              <option value="Volley" class="bg-[#0a1628] text-gray-300">Volée</option>
                              <option value="Smash" class="bg-[#0a1628] text-gray-300">Smash</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Date</label>
                            <input
                              type="datetime-local"
                              required
                              value={takenAt}
                              onChange={(e) => setTakenAt(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:ring-2 focus:ring-[#C8F135] focus:outline-none [color-scheme:dark]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Tags</label>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddNewTag();
                                }
                              }}
                              placeholder="Ajouter un tag..."
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[#C8F135] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleAddNewTag}
                              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                            >
                              <Plus size={18} />
                            </button>
                          </div>

                          {allTags.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs text-white/50 mb-2">Tags populaires:</p>
                              <div className="flex flex-wrap gap-2">
                                {allTags.slice(0, 6).map((tag) => (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => {
                                      if (!selectedTags.includes(tag.name)) {
                                        setSelectedTags([...selectedTags, tag.name]);
                                      }
                                    }}
                                    className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white/60 rounded text-xs transition-colors"
                                  >
                                    + {tag.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedTags.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                              {selectedTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 bg-[#C8F135] text-black rounded-full text-xs flex items-center gap-1"
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="hover:bg-[#d4f54a] rounded-full p-0.5"
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-4 flex gap-3">
                          <button type="button" onClick={() => setMode('select')} className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
                            Retour
                          </button>
                          <button type="submit" className="flex-[2] px-4 py-2 bg-[#C8F135] hover:bg-[#d4f54a] text-black rounded-lg font-bold transition-colors">
                            Enregistrer
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedVideo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 sm:p-6" onClick={closeVideoPlayer}>
          <div className="relative w-full max-w-5xl bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[calc(100vh-3rem)] sm:h-[calc(100vh-4rem)] max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-4rem)] border border-white/20" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/80 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Lecture</h2>
                {selectedVideo && (
                  <button
                    onClick={() => toggleFavorite(selectedVideo)}
                    className={`p-1.5 rounded-full transition-all ${
                      selectedVideo.favorite
                        ? 'text-[#C8F135] bg-[#C8F135]/10'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={selectedVideo.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <Star size={20} className={selectedVideo.favorite ? 'fill-current' : ''} />
                  </button>
                )}
                <button
                  onClick={() => handleDownloadVideo(selectedVideo.url)}
                  disabled={isDownloadingVideo}
                  className="p-1.5 rounded-full transition-all text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-50"
                  title="Télécharger la vidéo"
                >
                  {isDownloadingVideo ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                </button>
                {playlistMode && (
                  <p className="text-sm text-slate-400">
                    {currentPlaylistIndex + 1} / {sortedTimelineVideos.length}
                  </p>
                )}
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
                  {poseError && (
                    <AlertCircle size={16} className="text-red-400" />
                  )}
                </label>
                <button onClick={closeVideoPlayer} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div
              ref={videoAreaRef}
              className="flex-1 min-h-0 min-w-0 bg-black flex items-center justify-center overflow-hidden relative group"
              onMouseMove={resetControlsTimer}
              onTouchStart={resetControlsTimer}
            >
              <div className="relative w-full h-full min-h-0 min-w-0 flex items-center justify-center">
                <video
                  ref={videoPlayerRef}
                  src={selectedVideo.url}
                  crossOrigin="anonymous"
                  autoPlay
                  muted={false}
                  playsInline
                  webkit-playsinline="true"
                  onClick={togglePlay}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleEnded}
                  onPlay={() => {
                    setAutoplayBlocked(false);
                    setIsPlaying(true);
                  }}
                  onLoadStart={() => {
                    console.log('Video load started');
                  }}
                  onCanPlay={() => {
                    console.log('Video can play');
                  }}
                  className="w-full h-full min-h-0 min-w-0 object-contain z-10"
                  style={{ backgroundColor: '#000' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
                />

                {/* Video metadata overlay */}
                <div className={`absolute top-4 left-4 z-30 bg-slate-900/90 backdrop-blur-md rounded-lg p-3 sm:p-4 border border-slate-700 shadow-2xl transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <div className="grid grid-cols-1 gap-2 sm:gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <User size={12} /> Joueur
                      </span>
                      <span className="text-white font-medium text-sm">{selectedVideo.player_name}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Activity size={12} /> Coup
                      </span>
                      <span className="text-white font-medium text-sm">{selectedVideo.shot_type}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Calendar size={12} /> Date
                      </span>
                      <span className="text-white font-medium text-sm">{new Date(selectedVideo.taken_at).toLocaleDateString()}</span>
                    </div>
                    {selectedVideo.tags && selectedVideo.tags.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-xs flex items-center gap-1">
                          <TagIcon size={12} /> Tags
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {selectedVideo.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-full text-xs"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {autoplayBlocked && !isPlaying && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoPlayerRef.current) {
                        videoPlayerRef.current.play()
                          .then(() => {
                            setAutoplayBlocked(false);
                            setIsPlaying(true);
                          })
                          .catch(err => {
                            console.error('Play failed:', err);
                          });
                      }
                    }}
                  >
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95">
                      <Play className="text-white ml-2" size={40} fill="white" />
                    </div>
                  </div>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    frameStep('backward');
                  }}
                  className={`absolute left-2 top-1/2 -translate-y-1/2 z-40 p-2 bg-slate-900/80 hover:bg-slate-800/90 backdrop-blur-sm text-white rounded-lg transition-all hover:scale-110 border border-slate-700 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  title="Previous Frame (← Arrow Key)"
                >
                  <ChevronLeft size={28} strokeWidth={2.5} />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    frameStep('forward');
                  }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 z-40 p-2 bg-slate-900/80 hover:bg-slate-800/90 backdrop-blur-sm text-white rounded-lg transition-all hover:scale-110 border border-slate-700 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
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
                          className="p-1 sm:p-1.5 hover:bg-slate-700 active:bg-slate-700 rounded text-slate-400 hover:text-red-400 active:text-red-400 transition-colors"
                          title="Reset"
                        >
                          <Trash2 size={14} className="sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => setIsGraphCollapsed(true)}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          className="p-1 sm:p-1.5 hover:bg-slate-700 active:bg-slate-700 rounded text-slate-400 hover:text-white active:text-white transition-colors"
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
                      <canvas
                        ref={graphCanvasRef}
                        width={800}
                        height={400}
                        className="w-full h-full"
                      />
                      <div className="absolute top-1 left-1 sm:top-2 sm:left-2 pointer-events-auto z-10">
                        <div className="flex items-center gap-0.5 bg-slate-900/80 backdrop-blur-sm p-0.5 rounded border border-slate-600">
                          <button
                            onClick={() => setGraphMode('timeSeries')}
                            className={`p-1 rounded transition-all ${
                              graphMode === 'timeSeries'
                                ? 'bg-green-600 text-white shadow'
                                : 'text-slate-400 hover:text-white active:text-white hover:bg-slate-700 active:bg-slate-700'
                            }`}
                            title="Time Series"
                          >
                            <TrendingUp size={14} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => setGraphMode('2dPosition')}
                            className={`p-1 rounded transition-all ${
                              graphMode === '2dPosition'
                                ? 'bg-green-600 text-white shadow'
                                : 'text-slate-400 hover:text-white active:text-white hover:bg-slate-700 active:bg-slate-700'
                            }`}
                            title="2D Position"
                          >
                            <Activity size={14} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                      {graphMode === 'timeSeries' && (
                        <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 flex gap-1.5 sm:gap-3 bg-slate-900/70 px-1 py-0.5 sm:px-2 sm:py-1 rounded">
                          <button
                            onClick={() => setShowXAxis(!showXAxis)}
                            className="flex items-center gap-0.5 sm:gap-1.5 cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto"
                          >
                            <div className={`w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full ${showXAxis ? 'bg-red-400' : 'bg-slate-600'}`}></div>
                            <span className={`text-[9px] sm:text-xs font-medium ${showXAxis ? 'text-white' : 'text-slate-500'}`}>X</span>
                          </button>
                          <button
                            onClick={() => setShowYAxis(!showYAxis)}
                            className="flex items-center gap-0.5 sm:gap-1.5 cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto"
                          >
                            <div className={`w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full ${showYAxis ? 'bg-blue-400' : 'bg-slate-600'}`}></div>
                            <span className={`text-[9px] sm:text-xs font-medium ${showYAxis ? 'text-white' : 'text-slate-500'}`}>Y</span>
                          </button>
                          <button
                            onClick={() => setShowZAxis(!showZAxis)}
                            className="flex items-center gap-0.5 sm:gap-1.5 cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto"
                          >
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
                      {playlistMode && (
                        <button
                          onClick={() => {
                            if (currentPlaylistIndex > 0) {
                              const prevIndex = currentPlaylistIndex - 1;
                              setCurrentPlaylistIndex(prevIndex);
                              setSelectedVideo(sortedTimelineVideos[prevIndex]);
                            }
                          }}
                          disabled={currentPlaylistIndex === 0}
                          className={`text-white transition-colors ${
                            currentPlaylistIndex === 0
                              ? 'opacity-30 cursor-not-allowed'
                              : 'hover:text-green-600'
                          }`}
                          title="Previous Video"
                        >
                          <ChevronLeft size={24} />
                        </button>
                      )}
                      <button
                        onClick={togglePlay}
                        className="text-white hover:text-green-600 transition-colors"
                      >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                      </button>
                      {playlistMode && (
                        <button
                          onClick={() => {
                            if (currentPlaylistIndex < sortedTimelineVideos.length - 1) {
                              const nextIndex = currentPlaylistIndex + 1;
                              setCurrentPlaylistIndex(nextIndex);
                              setSelectedVideo(sortedTimelineVideos[nextIndex]);
                            }
                          }}
                          disabled={currentPlaylistIndex === sortedTimelineVideos.length - 1}
                          className={`text-white transition-colors ${
                            currentPlaylistIndex === sortedTimelineVideos.length - 1
                              ? 'opacity-30 cursor-not-allowed'
                              : 'hover:text-green-600'
                          }`}
                          title="Next Video"
                        >
                          <ChevronRight size={24} />
                        </button>
                      )}
                      <span className="text-sm font-medium text-white font-mono">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (videoPlayerRef.current) videoPlayerRef.current.currentTime = 0;
                        }}
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
        </div>
      )}
    </div>
    </>
  );
}
