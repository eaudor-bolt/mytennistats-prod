import { Camera, Clock, CheckCircle, Upload, Play } from 'lucide-react';

type MatchHistoryDisplayProps = {
  scoringHistory: any[];
  playerName: string;
  onPlayVideo?: (videoUrl: string) => void;
};

export function MatchHistoryDisplay({ scoringHistory, playerName, onPlayVideo }: MatchHistoryDisplayProps) {
  const tennisScores = ['0', '15', '30', '40'];

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
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Historique des points</h3>
      </div>
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {scoringHistory.slice().reverse().map((entry, index) => {
          const isWin = entry.toggleValue?.includes('Gagne');
          const isFault = entry.toggleValue?.includes('Faute');
          const isUploading = false;

          // Determine player: if player field exists, use it; otherwise determine from toggleValue
          const skill = entry.toggleValue?.split(': ')[0] || '';
          const player = entry.player || (skill === 'opponent' ? 'adversaire' : 'famille');

          return (
            <div key={entry.sequence || index} className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex gap-3 items-start">
              <div className="w-20 h-20 bg-slate-100 rounded flex items-center justify-center shrink-0 overflow-hidden relative">
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
                  <div className="text-slate-300">
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
                    {entry.duration && (
                      <span className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                        <Clock className="w-2.5 h-2.5" />
                        {entry.duration}s
                      </span>
                    )}
                    {isUploading ? (
                      <div className="flex items-center gap-1 text-[10px] text-orange-600 font-medium bg-orange-50 px-1.5 py-0.5 rounded">
                        <Upload className="w-2.5 h-2.5" />
                        <span>Uploading...</span>
                      </div>
                    ) : entry.videoUrl ? (
                      <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded">
                        <CheckCircle className="w-2.5 h-2.5" />
                        <span>Uploaded</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-1">
                  <p className="font-semibold text-slate-800 text-sm">
                    {entry.toggleValue}
                  </p>
                  {entry.server && (
                    <p className="text-xs text-blue-600 font-medium mt-0.5">
                      Service: {entry.server === 'famille' ? playerName : 'Adversaire'}
                    </p>
                  )}
                  {entry.timestamp && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {formatTimestamp(entry.timestamp)}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {entry.gameScore ? (
                      <>
                        Score Game: {entry.isTiebreak ? entry.gameScore.famille : (entry.gameScore.famille >= 4 ? 'AD' : tennisScores[entry.gameScore.famille] || '0')}/{entry.isTiebreak ? entry.gameScore.adversaire : (entry.gameScore.adversaire >= 4 ? 'AD' : tennisScores[entry.gameScore.adversaire] || '0')}
                        {entry.setScores && ` | Games: ${entry.setScores.famille.join('-')} / ${entry.setScores.adversaire.join('-')}`}
                      </>
                    ) : entry.setScores ? `Games: ${entry.setScores.famille.join('-')} / ${entry.setScores.adversaire.join('-')}` : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
