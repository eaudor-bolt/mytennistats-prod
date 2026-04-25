import { Camera, Clock, CheckCircle, Upload, Play } from 'lucide-react';
import { MiniScoreboard } from './MiniScoreboard';

type MatchHistoryDisplayProps = {
  scoringHistory: any[];
  playerName: string;
  onPlayVideo?: (videoUrl: string) => void;
};

export function MatchHistoryDisplay({ scoringHistory, playerName, onPlayVideo }: MatchHistoryDisplayProps) {
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

  return (
    <div className="bg-[#0a1628]/50 rounded-lg border border-white/10 overflow-hidden">
      <div className="bg-[#0f1e35]/80 px-4 py-3 border-b border-white/10">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Historique des points</h3>
      </div>
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {scoringHistory.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm italic">
            Aucun point enregistré pour le moment
          </div>
        )}
        {scoringHistory.slice().reverse().map((entry, index) => {
          const isUploading = false;

          const skill = entry.toggleValue?.split(': ')[0] || '';
          const player = entry.player || (skill === 'opponent' ? 'adversaire' : 'famille');

          return (
            <div key={entry.sequence || index} className="bg-white/5 backdrop-blur-sm rounded-lg shadow-sm border border-white/10 p-3 flex gap-3 items-start">
              <div className="w-20 h-20 bg-black/30 rounded flex items-center justify-center shrink-0 overflow-hidden relative border border-white/10">
                {entry.videoUrl ? (
                  <>
                    <video src={entry.videoUrl} className="w-full h-full object-cover" muted playsInline />
                    {onPlayVideo ? (
                      <button
                        onClick={() => onPlayVideo(entry.videoUrl)}
                        className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                      >
                        <Play className="text-white w-8 h-8 opacity-80 fill-white" />
                      </button>
                    ) : (
                      <a
                        href={entry.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Camera className="text-white w-8 h-8 opacity-80" />
                      </a>
                    )}
                  </>
                ) : (
                  <div className="text-gray-600">
                    <Camera className="w-8 h-8" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    player === 'famille'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {player === 'famille' ? 'Point gagné' : 'Point perdu'}
                  </span>

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
                    {entry.toggleValue}
                  </p>
                  {entry.server && (
                    <p className="text-xs text-[#C8F135] font-medium mt-0.5">
                      Service: {entry.server === 'famille' ? playerName : 'Adversaire'}
                    </p>
                  )}
                  {entry.timestamp && (
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      {formatTimestamp(entry.timestamp)}
                    </p>
                  )}
                  {entry.gameScore && entry.setScores && (
                    <div className="mt-2">
                      <MiniScoreboard
                        playerName={playerName}
                        opponentName="Adversaire"
                        gameScore={entry.gameScore}
                        setScores={entry.setScores}
                        currentSet={entry.currentSet ?? 0}
                        isTiebreak={entry.isTiebreak ?? false}
                        currentServer={entry.currentServer}
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
  );
}
