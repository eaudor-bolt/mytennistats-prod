import { Trophy } from 'lucide-react';

type MiniMatchScoreboardProps = {
  score: string;
  playerName: string;
  opponentName: string;
  isWinner: boolean;
};

export function MiniMatchScoreboard({ score, playerName, opponentName, isWinner }: MiniMatchScoreboardProps) {
  if (!score) return <span className="text-gray-400">-</span>;

  const parseScore = (scoreString: string) => {
    const sets = scoreString.split(' - ');
    const playerSets: number[] = [];
    const opponentSets: number[] = [];

    sets.forEach(set => {
      const cleanSet = set.replace(/\s*\(.*?\)\s*/g, '').trim();
      const [player, opponent] = cleanSet.split('/').map(s => parseInt(s.trim()));

      if (!isNaN(player) && !isNaN(opponent)) {
        playerSets.push(player);
        opponentSets.push(opponent);
      }
    });

    let playerSetsWon = 0;
    let opponentSetsWon = 0;
    playerSets.forEach((setScore, index) => {
      if (setScore > opponentSets[index]) {
        playerSetsWon++;
      } else if (opponentSets[index] > setScore) {
        opponentSetsWon++;
      }
    });

    return { playerSets, opponentSets, playerSetsWon, opponentSetsWon };
  };

  const { playerSets, opponentSets, playerSetsWon, opponentSetsWon } = parseScore(score);
  const maxSets = Math.max(playerSets.length, 3);

  return (
    <div className="bg-gradient-to-br from-[#0f1e35]/50 to-[#0a1628]/50 rounded-lg p-2 shadow-inner border border-white/5 inline-block">
      <div className="flex items-center justify-center">
        <div className="min-w-0">
          <table className="bg-white/5 backdrop-blur-sm rounded-md shadow-sm overflow-hidden border border-white/10">
            <tbody>
              <tr className="border-b border-white/10">
                <td className="px-2 py-1.5 text-xs font-semibold text-gray-200 bg-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="truncate max-w-[100px]">{opponentName}</span>
                    </div>
                  </div>
                </td>
                {Array.from({ length: maxSets }).map((_, i) => (
                  <td key={i} className={`px-2 py-1.5 text-center text-sm font-bold ${opponentSets[i] !== undefined ? 'text-gray-300' : 'text-gray-600'}`}>
                    {opponentSets[i] !== undefined ? opponentSets[i] : '-'}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center font-bold text-lg bg-white/5">
                  <span className={opponentSetsWon > playerSetsWon ? 'text-[#C8F135]' : 'text-gray-400'}>
                    {opponentSetsWon}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 text-xs font-semibold text-gray-200 bg-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="truncate max-w-[100px]">{playerName}</span>
                      {isWinner && (
                        <Trophy className="w-3 h-3 text-[#C8F135] flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </td>
                {Array.from({ length: maxSets }).map((_, i) => (
                  <td key={i} className={`px-2 py-1.5 text-center text-sm font-bold ${playerSets[i] !== undefined ? 'text-gray-300' : 'text-gray-600'}`}>
                    {playerSets[i] !== undefined ? playerSets[i] : '-'}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center font-bold text-lg bg-white/5">
                  <span className={playerSetsWon > opponentSetsWon ? 'text-[#C8F135]' : 'text-gray-400'}>
                    {playerSetsWon}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
