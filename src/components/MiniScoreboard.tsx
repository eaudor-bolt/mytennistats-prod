type MiniScoreboardProps = {
  playerName: string;
  opponentName: string;
  gameScore: { famille: number; adversaire: number };
  setScores: { famille: number[]; adversaire: number[] };
  currentSet: number;
  isTiebreak: boolean;
  currentServer?: 'famille' | 'adversaire';
  gameFormat?: {
    supertiebreak?: boolean;
  };
  tiebreakScores?: Record<number, { famille: number; adversaire: number }>;
};

const tennisScores = ['0', '15', '30', '40', 'AD'];

export function MiniScoreboard({
  playerName,
  opponentName,
  gameScore,
  setScores,
  currentSet,
  isTiebreak,
  currentServer,
  gameFormat,
  tiebreakScores
}: MiniScoreboardProps) {

  const getDisplayScore = (score: number) => {
    if (isTiebreak) return score.toString();
    if (score >= 4) return 'AD';
    return tennisScores[score] || '0';
  };

  return (
    <div className="bg-gradient-to-br from-[#0f1e35]/50 to-[#0a1628]/50 rounded-lg p-2 shadow-inner border border-white/5">
      <table className="w-full bg-white/5 backdrop-blur-sm rounded-md shadow-sm overflow-hidden border border-white/10">
        <tbody>
          <tr className="border-b border-white/10">
            <td className="px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-gray-200 bg-white/5">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="truncate">{opponentName || 'Adversaire'}</span>
                  {currentServer === 'adversaire' && (
                    <img src="/tennis-ball.svg" alt="Serving" className="w-2 h-2 flex-shrink-0" />
                  )}
                </div>
                <span className="text-white font-bold text-xs">{getDisplayScore(gameScore.adversaire)}</span>
              </div>
            </td>
            {[0, 1, 2].map(i => (
              <td
                key={i}
                className={`px-2 py-1.5 text-center text-xs font-bold ${
                  currentSet === i ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'
                }`}
              >
                {setScores.adversaire[i]}
                {tiebreakScores?.[i] && !(i === 2 && gameFormat?.supertiebreak) && (
                  <sup className="text-[8px]">{tiebreakScores[i].adversaire}</sup>
                )}
              </td>
            ))}
          </tr>
          <tr>
            <td className="px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-gray-200 bg-white/5">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="truncate">{playerName || 'Joueur'}</span>
                  {currentServer === 'famille' && (
                    <img src="/tennis-ball.svg" alt="Serving" className="w-2 h-2 flex-shrink-0" />
                  )}
                </div>
                <span className="text-white font-bold text-xs">{getDisplayScore(gameScore.famille)}</span>
              </div>
            </td>
            {[0, 1, 2].map(i => (
              <td
                key={i}
                className={`px-2 py-1.5 text-center text-xs font-bold ${
                  currentSet === i ? 'bg-[#C8F135]/20 text-[#C8F135]' : 'text-gray-300'
                }`}
              >
                {setScores.famille[i]}
                {tiebreakScores?.[i] && !(i === 2 && gameFormat?.supertiebreak) && (
                  <sup className="text-[8px]">{tiebreakScores[i].famille}</sup>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
