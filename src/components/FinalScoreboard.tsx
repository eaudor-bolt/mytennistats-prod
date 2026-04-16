import { Trophy } from 'lucide-react';

type FinalScoreboardProps = {
  score: string;
  playerName: string;
  isWin: boolean;
  showWinnerIcon?: boolean;
};

export function FinalScoreboard({ score, playerName, isWin, showWinnerIcon = false }: FinalScoreboardProps) {
  const parseScore = (scoreString: string) => {
    const sets = scoreString.split(' - ');
    const playerSets: number[] = [];
    const opponentSets: number[] = [];

    sets.forEach(set => {
      // Handle super tiebreak format (10/5)
      const superTiebreakMatch = set.match(/^\((\d+)\/(\d+)\)$/);
      if (superTiebreakMatch) {
        const player = parseInt(superTiebreakMatch[1]);
        const opponent = parseInt(superTiebreakMatch[2]);
        playerSets.push(player);
        opponentSets.push(opponent);
        return;
      }

      // Handle regular set format, removing tiebreak notation
      const cleanSet = set.replace(/\s*\(.*?\)\s*/g, '');
      const scores = cleanSet.split('/').map(s => parseInt(s.trim()));
      if (scores.length === 2) {
        playerSets.push(scores[0]);
        opponentSets.push(scores[1]);
      }
    });

    // Fill missing sets with 0
    while (playerSets.length < 3) {
      playerSets.push(0);
      opponentSets.push(0);
    }

    return { playerSets, opponentSets };
  };

  const { playerSets, opponentSets } = parseScore(score);
  const playerSetsWon = playerSets.filter((s, i) => s > opponentSets[i]).length;
  const opponentSetsWon = opponentSets.filter((s, i) => s > playerSets[i]).length;

  // Determine winner by counting sets won (more sets = winner)
  const playerWon = playerSetsWon > opponentSetsWon;
  const opponentWon = opponentSetsWon > playerSetsWon;

  return (
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
                      {showWinnerIcon && opponentWon && (
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135]" />
                      )}
                    </div>
                  </div>
                </td>
                {[0, 1, 2].map(i => (
                  <td
                    key={i}
                    className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-sm sm:text-base font-bold text-gray-300"
                  >
                    {opponentSets[i]}
                  </td>
                ))}
                <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-center font-bold text-lg sm:text-2xl bg-[#C8F135]/20 text-[#C8F135]">
                  {opponentSetsWon}
                </td>
              </tr>
              <tr>
                <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-200 bg-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                      <span className="truncate">{playerName}</span>
                      {showWinnerIcon && playerWon && (
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135]" />
                      )}
                    </div>
                  </div>
                </td>
                {[0, 1, 2].map(i => (
                  <td
                    key={i}
                    className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-sm sm:text-base font-bold text-gray-300"
                  >
                    {playerSets[i]}
                  </td>
                ))}
                <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-center font-bold text-lg sm:text-2xl bg-[#C8F135]/20 text-[#C8F135]">
                  {playerSetsWon}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
