import { Trophy } from 'lucide-react';

type FinalScoreboardProps = {
  score: string;
  playerName: string;
  isWin: boolean;
  showWinnerIcon?: boolean;
  retirementPlayer?: 'adversaire' | 'famille' | null;
};

type ParsedSet = {
  playerGames: number;
  opponentGames: number;
  playerTB: string | null;
  opponentTB: string | null;
};

export function FinalScoreboard({ score, playerName, isWin, showWinnerIcon = false, retirementPlayer = null }: FinalScoreboardProps) {
  const parseScore = (scoreString: string): { sets: ParsedSet[]; playerSetsWon: number; opponentSetsWon: number } => {
    const rawSets = scoreString.split(' - ');
    const sets: ParsedSet[] = [];
    let playerSetsWon = 0;
    let opponentSetsWon = 0;

    rawSets.forEach(set => {
      const superTiebreakMatch = set.match(/^\((\d+)\/(\d+)\)$/);
      if (superTiebreakMatch) {
        const player = parseInt(superTiebreakMatch[1]);
        const opponent = parseInt(superTiebreakMatch[2]);
        sets.push({ playerGames: player, opponentGames: opponent, playerTB: null, opponentTB: null });
        if (player > opponent) playerSetsWon++;
        else opponentSetsWon++;
        return;
      }

      const tiebreakMatch = set.match(/\((\d+)(?:\/(\d+))?\)/);
      const cleanSet = set.replace(/\s*\(.*?\)\s*/g, '').trim();
      const [playerGames, opponentGames] = cleanSet.split('/').map(s => parseInt(s.trim()));

      if (isNaN(playerGames) || isNaN(opponentGames)) return;

      let playerTB: string | null = null;
      let opponentTB: string | null = null;

      if (tiebreakMatch) {
        if (tiebreakMatch[2] !== undefined) {
          playerTB = tiebreakMatch[1];
          opponentTB = tiebreakMatch[2];
        } else {
          const loserTB = parseInt(tiebreakMatch[1]);
          const winnerTB = Math.max(loserTB + 2, 7);
          if (playerGames > opponentGames) {
            playerTB = String(winnerTB);
            opponentTB = tiebreakMatch[1];
          } else {
            playerTB = tiebreakMatch[1];
            opponentTB = String(winnerTB);
          }
        }
      }

      if (playerGames > opponentGames) playerSetsWon++;
      else if (opponentGames > playerGames) opponentSetsWon++;

      sets.push({ playerGames, opponentGames, playerTB, opponentTB });
    });

    while (sets.length < 3) {
      sets.push({ playerGames: 0, opponentGames: 0, playerTB: null, opponentTB: null });
    }

    return { sets, playerSetsWon, opponentSetsWon };
  };

  const { sets, playerSetsWon, opponentSetsWon } = parseScore(score);
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
                  <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                    <span className="truncate">Adversaire</span>
                    {showWinnerIcon && opponentWon && (
                      <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135]" />
                    )}
                    {retirementPlayer === 'adversaire' && (
                      <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded whitespace-nowrap">
                        Abandon
                      </span>
                    )}
                  </div>
                </td>
                {sets.map((s, i) => (
                  <td
                    key={i}
                    className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-sm sm:text-base font-bold ${s.opponentGames > s.playerGames ? 'text-white' : 'text-gray-400'}`}
                  >
                    <span>
                      {s.opponentGames}
                      {s.opponentTB && (
                        <sup className="text-[9px] sm:text-[10px] text-gray-500 ml-px">{s.opponentTB}</sup>
                      )}
                    </span>
                  </td>
                ))}
                <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-center font-bold text-lg sm:text-2xl bg-[#C8F135]/20 text-[#C8F135]">
                  {opponentSetsWon}
                </td>
              </tr>
              <tr>
                <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-200 bg-white/5">
                  <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                    <span className="truncate">{playerName}</span>
                    {showWinnerIcon && playerWon && (
                      <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135]" />
                    )}
                    {retirementPlayer === 'famille' && (
                      <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded whitespace-nowrap">
                        Abandon
                      </span>
                    )}
                  </div>
                </td>
                {sets.map((s, i) => (
                  <td
                    key={i}
                    className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-center text-sm sm:text-base font-bold ${s.playerGames > s.opponentGames ? 'text-white' : 'text-gray-400'}`}
                  >
                    <span>
                      {s.playerGames}
                      {s.playerTB && (
                        <sup className="text-[9px] sm:text-[10px] text-gray-500 ml-px">{s.playerTB}</sup>
                      )}
                    </span>
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
