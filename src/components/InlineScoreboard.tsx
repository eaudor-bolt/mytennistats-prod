import { useRef, useEffect } from 'react';

type InlineScoreboardProps = {
  setScores: {
    adversaire: number[];
    famille: number[];
  };
  gameScore: {
    adversaire: string;
    famille: string;
  };
  size?: 'small' | 'normal';
  playerName?: string;
  server?: 'adversaire' | 'famille';
};

const convertToTennisScore = (score: string | number): string => {
  const scoreStr = String(score);

  const scoreMap: Record<string, string> = {
    '0': '0',
    '1': '15',
    '2': '30',
    '3': '40',
    '4': 'AD',
  };

  return scoreMap[scoreStr] || scoreStr;
};

export function InlineScoreboard({ setScores, gameScore, size = 'normal', playerName = 'Joueur', server }: InlineScoreboardProps) {
  const isSmall = size === 'small';
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        containerRef.current.scrollLeft = containerRef.current.scrollWidth;
      }
    }
  }, [gameScore, setScores]);

  return (
    <div
      ref={containerRef}
      className={`bg-gradient-to-br from-[#0f1e35]/50 to-[#0a1628]/50 rounded-xl ${isSmall ? 'p-2' : 'p-2 sm:p-4'} shadow-inner border border-white/5 flex-shrink-0 overflow-x-auto`}
    >
      <div className="flex items-center justify-center">
        <div className="flex-1 min-w-0">
          <table className="w-full bg-white/5 backdrop-blur-sm rounded-lg shadow-sm overflow-hidden border border-white/10">
            <tbody>
              <tr className="border-b border-white/10">
                <td className={`${isSmall ? 'px-1.5 py-1.5' : 'px-1.5 sm:px-3 py-1.5 sm:py-2'} ${isSmall ? 'text-xs' : 'text-xs sm:text-sm'} font-semibold text-gray-200 bg-white/5`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                      <span className="truncate">Adversaire</span>
                      {server === 'adversaire' && (
                        <img src="/tennis-ball.svg" alt="Serving" className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        disabled
                        className="w-10 h-6 sm:w-12 sm:h-7 flex items-center justify-center bg-red-500 text-white text-xs sm:text-sm font-bold rounded shadow transition-all flex-shrink-0 cursor-not-allowed opacity-90"
                        title=""
                      >
                        {convertToTennisScore(gameScore.adversaire)}
                      </button>
                    </div>
                  </div>
                </td>
                {[0, 1, 2].map(i => (
                  <td key={i} className={`${isSmall ? 'px-1.5 py-1.5' : 'px-1.5 sm:px-3 py-1.5 sm:py-2'} text-center ${isSmall ? 'text-sm' : 'text-sm sm:text-base'} font-bold ${i === 0 ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'}`}>
                    {setScores.adversaire[i] || 0}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`${isSmall ? 'px-1.5 py-1.5' : 'px-1.5 sm:px-3 py-1.5 sm:py-2'} ${isSmall ? 'text-xs' : 'text-xs sm:text-sm'} font-semibold text-gray-200 bg-white/5`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                      <span className="truncate">{playerName}</span>
                      {server === 'famille' && (
                        <img src="/tennis-ball.svg" alt="Serving" className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        disabled
                        className="w-10 h-6 sm:w-12 sm:h-7 flex items-center justify-center bg-green-500 text-white text-xs sm:text-sm font-bold rounded shadow transition-all flex-shrink-0 cursor-not-allowed opacity-90"
                        title=""
                      >
                        {convertToTennisScore(gameScore.famille)}
                      </button>
                    </div>
                  </div>
                </td>
                {[0, 1, 2].map(i => (
                  <td key={i} className={`${isSmall ? 'px-1.5 py-1.5' : 'px-1.5 sm:px-3 py-1.5 sm:py-2'} text-center ${isSmall ? 'text-sm' : 'text-sm sm:text-base'} font-bold ${i === 0 ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'}`}>
                    {setScores.famille[i] || 0}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
