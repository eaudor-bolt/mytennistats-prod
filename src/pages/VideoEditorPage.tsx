import { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, MapPin, Download, Trash2, Maximize,
  Upload, ChevronLeft, ChevronRight, RotateCcw, X, CheckCircle
} from 'lucide-react';
import { useAlert } from '../hooks/useAlert';

interface Marker {
  id: number;
  time: number;
  title: string;
}

interface VideoPlayerData {
  id: number;
  src: string;
  name: string;
  file: File;
}

const VideoEditorInstance = ({ videoData, onRemove }: { videoData: VideoPlayerData; onRemove: (id: number) => void }) => {
  const { id, src, name, file } = videoData;
  const { showAlert, AlertComponent } = useAlert();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [markerTitle, setMarkerTitle] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  const [fps, setFps] = useState(30);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const frameDuration = 1 / fps;

  useEffect(() => {
    loadMarkers(name);
  }, [name]);

  const loadMarkers = (fileName: string) => {
    try {
      const savedMarkers = localStorage.getItem(`videoMarkers_${fileName}`);
      if (savedMarkers) {
        setMarkers(JSON.parse(savedMarkers));
      } else {
        setMarkers([]);
      }
    } catch (e) {
      console.error('Error loading markers:', e);
      setMarkers([]);
    }
  };

  const saveMarkers = (updatedMarkers: Marker[]) => {
    try {
      localStorage.setItem(`videoMarkers_${name}`, JSON.stringify(updatedMarkers));
    } catch (e) {
      console.error('Error saving markers:', e);
    }
  };

  const exportMarkers = () => {
    if (!markers.length) return;

    const dataStr = JSON.stringify(markers, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportFileName = `${name.replace(/\.[^/.]+$/, '')}_markers.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  };

  const importMarkers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedMarkers = JSON.parse(event.target?.result as string);
        setMarkers(importedMarkers);
        saveMarkers(importedMarkers);
      } catch (error) {
        console.error('Error importing markers:', error);
        showAlert('Invalid markers file', { type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const addMarker = () => {
    if (!videoRef.current || !name) return;

    const newMarker: Marker = {
      id: Date.now(),
      time: videoRef.current.currentTime,
      title: markerTitle || `Marker at ${formatTime(videoRef.current.currentTime)}`
    };

    const updatedMarkers = [...markers, newMarker];
    setMarkers(updatedMarkers);
    saveMarkers(updatedMarkers);
    setMarkerTitle('');
  };

  const removeMarker = (markerId: number) => {
    const updatedMarkers = markers.filter(marker => marker.id !== markerId);
    setMarkers(updatedMarkers);
    saveMarkers(updatedMarkers);
  };

  const updateMarkerTitle = (markerId: number, newTitle: string) => {
    const updatedMarkers = markers.map(marker =>
      marker.id === markerId ? { ...marker, title: newTitle } : marker
    );
    setMarkers(updatedMarkers);
    saveMarkers(updatedMarkers);
  };

  const jumpToMarker = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleFullScreen = () => {
    const videoWrapper = document.querySelector(`.video-wrapper-${id}`) as HTMLElement;

    if (!document.fullscreenElement) {
      videoWrapper?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = pos * videoRef.current.duration;
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = parseFloat(e.target.value);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const seekFrame = (forward = true) => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      const frameTime = forward ? frameDuration : -frameDuration;
      videoRef.current.currentTime += frameTime;
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
      if (sliderRef.current) {
        sliderRef.current.value = video.currentTime.toString();
      }
    };

    const updateDuration = () => {
      setDuration(video.duration);
      setVideoWidth(video.videoWidth);
      setVideoHeight(video.videoHeight);
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [src]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimecode = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    const frames = Math.floor((time % 1) * fps);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative mb-8 border border-slate-700 rounded-xl p-6 bg-slate-900/50">
      <button
        onClick={() => onRemove(id)}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors z-10"
      >
        <X size={16} />
      </button>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className={`flex-1 video-wrapper-${id} relative bg-black rounded-lg overflow-hidden aspect-video group`}>
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            onClick={togglePlay}
          />

          <button
            onClick={() => seekFrame(false)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            title="Previous Frame (Left Arrow)"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={() => seekFrame(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            title="Next Frame (Right Arrow)"
          >
            <ChevronRight size={20} />
          </button>

          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 hover:opacity-100 transition-opacity">
            <div className="relative mb-3">
              <div
                ref={timelineRef}
                onClick={handleTimelineClick}
                className="h-1.5 bg-white/30 rounded-full cursor-pointer relative"
              >
                <div
                  className="h-full bg-green-600 rounded-full"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />

                {markers.map(marker => (
                  <div
                    key={marker.id}
                    className="absolute w-3 h-3 bg-red-500 rounded-full -top-[3px] -ml-1.5 cursor-pointer hover:scale-125 transition-transform"
                    style={{ left: `${(marker.time / duration) * 100}%` }}
                    title={marker.title}
                    onClick={(e) => {
                      e.stopPropagation();
                      jumpToMarker(marker.time);
                    }}
                  />
                ))}
              </div>
              <input
                type="range"
                ref={sliderRef}
                min="0"
                max={duration || 0}
                step="0.01"
                value={currentTime}
                onChange={handleSliderChange}
                className="absolute top-0 left-0 w-full h-1.5 opacity-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="text-white hover:text-green-400 transition-colors">
                  {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                </button>

                <div className="text-white text-sm font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>

                <button
                  onClick={addMarker}
                  className="text-white hover:text-red-400 transition-colors"
                  title="Add Marker (M)"
                >
                  <MapPin size={20} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[16, 8, 4, 2, 1, 0.5, 0.25, 0.125].map((rate) => (
                    <button
                      key={rate}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        playbackRate === rate
                          ? 'bg-green-600 text-white'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                      onClick={() => changePlaybackRate(rate)}
                    >
                      {rate >= 1 ? `${rate}x` : `1/${1/rate}`}
                    </button>
                  ))}
                </div>

                <button
                  onClick={toggleFullScreen}
                  className="text-white hover:text-green-400 transition-colors ml-2"
                  title="Full Screen"
                >
                  <Maximize size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-96 bg-slate-800/50 rounded-lg p-4 space-y-4 max-h-[600px] overflow-y-auto">
          <h3 className="text-white font-semibold truncate">{name}</h3>

          <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
            <h4 className="text-slate-300 text-sm font-semibold">Video Information</h4>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="text-white font-mono">{formatTime(duration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Resolution:</span>
                <span className="text-white font-mono">{videoWidth} × {videoHeight}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">FPS:</span>
                <span className="text-white font-mono">{fps.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Position:</span>
                <span className="text-white font-mono">{formatTimecode(currentTime)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Marker title"
              value={markerTitle}
              onChange={(e) => setMarkerTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMarker()}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-green-600 outline-none"
            />
            <button
              onClick={addMarker}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportMarkers}
              disabled={markers.length === 0}
              className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded text-sm transition-colors"
            >
              Export
            </button>

            <label className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm text-center cursor-pointer transition-colors">
              Import
              <input
                type="file"
                accept=".json"
                onChange={importMarkers}
                className="hidden"
              />
            </label>
          </div>

          {markers.length > 0 ? (
            <div className="space-y-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-400 font-medium pb-2">Time</th>
                    <th className="text-left text-slate-400 font-medium pb-2">Title</th>
                    <th className="text-right text-slate-400 font-medium pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {markers.map(marker => (
                    <tr key={marker.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td
                        onClick={() => jumpToMarker(marker.time)}
                        className="py-2 text-white font-mono text-xs cursor-pointer hover:text-green-400"
                      >
                        {formatTime(marker.time)}
                      </td>
                      <td
                        className="py-2 text-slate-300 truncate max-w-[120px] cursor-pointer hover:text-white"
                        onClick={() => {
                          const newTitle = prompt("Edit marker title:", marker.title);
                          if (newTitle !== null && newTitle.trim() !== "") {
                            updateMarkerTitle(marker.id, newTitle.trim());
                          }
                        }}
                        title="Click to edit"
                      >
                        {marker.title}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => removeMarker(marker.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center italic py-4">No markers yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

const VideoEditorPage = () => {
  const [videoPlayers, setVideoPlayers] = useState<VideoPlayerData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      addVideoPlayer(file);
    }
  };

  const addVideoPlayer = (file: File) => {
    if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);

      const newPlayer: VideoPlayerData = {
        id: Date.now(),
        src: url,
        name: file.name,
        file: file
      };
      setVideoPlayers(prev => [...prev, newPlayer]);
    }
  };

  const removeVideoPlayer = (id: number) => {
    setVideoPlayers(prev => {
      const filtered = prev.filter(player => player.id !== id);
      const removedPlayer = prev.find(player => player.id === id);
      if (removedPlayer) {
        URL.revokeObjectURL(removedPlayer.src);
      }
      return filtered;
    });
  };

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        addVideoPlayer(file);
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  return (
    <>
      <AlertComponent />
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.location.href = '/#/videos'}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <h1 className="text-2xl font-bold text-white">Video Editor</h1>
          </div>

          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="video-editor-input"
            />
            <label
              htmlFor="video-editor-input"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg cursor-pointer transition-colors"
            >
              <Upload size={20} />
              <span>Select Video</span>
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {videoPlayers.length === 0 && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-slate-600 hover:border-green-600 rounded-xl transition-colors cursor-pointer bg-slate-900/30"
          >
            <Upload size={64} className="text-slate-500 mb-4" />
            <p className="text-slate-300 text-lg mb-2">Drop video file here or click to select</p>
            <p className="text-slate-500 text-sm">Frame-by-frame editing with markers</p>
          </div>
        )}

        <div className="space-y-6">
          {videoPlayers.map(player => (
            <VideoEditorInstance
              key={player.id}
              videoData={player}
              onRemove={removeVideoPlayer}
            />
          ))}
        </div>

        {videoPlayers.length > 0 && (
          <div className="mt-6 text-center text-slate-400 text-sm">
            <p>Keyboard shortcuts: Left/Right arrows for frame navigation, Space to play/pause, M to add marker</p>
          </div>
        )}
      </main>
    </div>
    </>
  );
};

export default VideoEditorPage;
