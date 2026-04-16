type ScoreboardDisplayProps = {
  score: string;
  playerName: string;
  isWin: boolean;
};

export function ScoreboardDisplay({ score, playerName, isWin }: ScoreboardDisplayProps) {
  const parseScore = (scoreString: string) => {
    const sets = scoreString.split(' - ').map(set => {
      const hasTiebreak = set.includes('(');
      let playerScore = 0;
      let opponentScore = 0;
      let tiebreakPlayer = null;
      let tiebreakOpponent = null;

      if (hasTiebreak) {
        const mainMatch = set.match(/(\d+)\/(\d+)\s*\((\d+)-(\d+)\)/);
        if (mainMatch) {
          playerScore = parseInt(mainMatch[1]);
          opponentScore = parseInt(mainMatch[2]);
          tiebreakPlayer = parseInt(mainMatch[3]);
          tiebreakOpponent = parseInt(mainMatch[4]);
        }
      } else {
        const scores = set.split('/').map(s => parseInt(s.trim()));
        if (scores.length === 2) {
          playerScore = scores[0];
          opponentScore = scores[1];
        }
      }

      return { playerScore, opponentScore, tiebreakPlayer, tiebreakOpponent };
    });

    return sets;
  };

  const sets = parseScore(score);
  const playerSetsWon = sets.filter(s => s.playerScore > s.opponentScore).length;
  const opponentSetsWon = sets.filter(s => s.opponentScore > s.playerScore).length;

  return (
    <div className="bg-gradient-to-br from-[#0f1e35]/50 to-[#0a1628]/50 rounded-xl p-2 sm:p-4 shadow-inner border border-white/5">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 text-center">
        Score Final
      </h3>
      <table className="w-full bg-white/5 backdrop-blur-sm rounded-lg shadow-sm overflow-hidden border border-white/10">
        <thead>
          <tr className="bg-white/5 border-b border-white/10">
            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm font-semibold text-gray-200">Joueur</th>
            {sets.map((_, index) => (
              <th key={index} className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-semibold text-gray-200">
                Set {index + 1}
              </th>
            ))}
            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-semibold text-gray-200">Sets</th>
          </tr>
        </thead>
        <tbody>
          <tr className={`border-b border-white/10 ${isWin ? 'bg-green-500/10' : 'bg-white/5'}`}>
            <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base font-bold text-white">
              {playerName}
              {isWin && (
                <span className="ml-2 text-green-400 text-sm">✓</span>
              )}
            </td>
            {sets.map((set, index) => (
              <td
                key={index}
                className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-center font-bold text-sm sm:text-lg ${
                  set.playerScore > set.opponentScore ? 'text-green-400' : 'text-gray-300'
                }`}
              >
                {set.playerScore}
                {set.tiebreakPlayer !== null && (
                  <sup className="text-xs ml-0.5">{set.tiebreakPlayer}</sup>
                )}
              </td>
            ))}
            <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-center font-bold text-xl sm:text-2xl text-green-400">
              {playerSetsWon}
            </td>
          </tr>
          <tr className={!isWin ? 'bg-red-500/10' : 'bg-white/5'}>
            <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base font-bold text-white">
              Adversaire
              {!isWin && (
                <span className="ml-2 text-red-400 text-sm">✓</span>
              )}
            </td>
            {sets.map((set, index) => (
              <td
                key={index}
                className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-center font-bold text-sm sm:text-lg ${
                  set.opponentScore > set.playerScore ? 'text-red-400' : 'text-gray-300'
                }`}
              >
                {set.opponentScore}
                {set.tiebreakOpponent !== null && (
                  <sup className="text-xs ml-0.5">{set.tiebreakOpponent}</sup>
                )}
              </td>
            ))}
            <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-center font-bold text-xl sm:text-2xl text-red-400">
              {opponentSetsWon}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
