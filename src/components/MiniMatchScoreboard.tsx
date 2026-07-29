import { Trophy } from 'lucide-react';

type MiniMatchScoreboardProps = {
  score: string;
  playerName: string;
  opponentName: string;
  isWinner: boolean;
};

type ParsedSet = {
  playerGames: number;
  opponentGames: number;
  playerTB: string | null;
  opponentTB: string | null;
};

export function MiniMatchScoreboard({ score, playerName, opponentName, isWinner }: MiniMatchScoreboardProps) {
  if (!score) return <span className="text-gray-400">-</span>;

  const parseScore = (scoreString: string): { sets: ParsedSet[]; playerSetsWon: number; opponentSetsWon: number } => {
    const rawSets = scoreString.split(' - ');
    const sets: ParsedSet[] = [];
    let playerSetsWon = 0;
    let opponentSetsWon = 0;

    rawSets.forEach(set => {
      // Super tiebreak decider set, stored as "(10/5)" with no games score of
      // its own - handle it before the regular-set parsing below, which
      // would otherwise strip the parens, find nothing left to split on,
      // and silently drop this set (and its winner) entirely.
      const superTiebreakMatch = set.match(/^\((\d+)\/(\d+)\)$/);
      if (superTiebreakMatch) {
        const playerGames = parseInt(superTiebreakMatch[1]);
        const opponentGames = parseInt(superTiebreakMatch[2]);
        if (playerGames > opponentGames) playerSetsWon++;
        else if (opponentGames > playerGames) opponentSetsWon++;
        sets.push({ playerGames, opponentGames, playerTB: null, opponentTB: null });
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
          // Format: (playerTB/opponentTB)
          playerTB = tiebreakMatch[1];
          opponentTB = tiebreakMatch[2];
        } else {
          // Format: (loserTB) - single number is the loser's tiebreak score
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

      if (playerGames > opponentGames) {
        playerSetsWon++;
      } else if (opponentGames > playerGames) {
        opponentSetsWon++;
      }

      sets.push({ playerGames, opponentGames, playerTB, opponentTB });
    });

    return { sets, playerSetsWon, opponentSetsWon };
  };

  const { sets, playerSetsWon, opponentSetsWon } = parseScore(score);
  const maxSets = Math.max(sets.length, 3);

  return (
    <div className="inline-block">
      <table className="bg-[#0a1628]/80 backdrop-blur-sm rounded-md shadow-sm overflow-hidden border border-white/10">
        <tbody>
          <tr className="border-b border-white/10">
            <td className="px-2 py-1.5 text-xs font-semibold text-gray-200 bg-white/5">
              <div className="flex items-center gap-1 min-w-0">
                <span className="truncate max-w-[80px]">{opponentName}</span>
                {!isWinner && (
                  <Trophy className="w-3 h-3 text-[#C8F135] flex-shrink-0" />
                )}
              </div>
            </td>
            {Array.from({ length: maxSets }).map((_, i) => (
              <td key={i} className={`px-2 py-1.5 text-center text-sm font-bold ${sets[i] ? (sets[i].opponentGames > sets[i].playerGames ? 'text-white' : 'text-gray-400') : 'text-gray-600'}`}>
                {sets[i] ? (
                  <span>
                    {sets[i].opponentGames}
                    {sets[i].opponentTB && (
                      <sup className="text-[9px] text-gray-500 ml-px">{sets[i].opponentTB}</sup>
                    )}
                  </span>
                ) : '-'}
              </td>
            ))}
            <td className="px-2 py-1.5 text-center font-bold text-lg bg-white/5">
              <span className={opponentSetsWon > playerSetsWon ? 'text-[#C8F135]' : 'text-gray-500'}>
                {opponentSetsWon}
              </span>
            </td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 text-xs font-semibold text-gray-200 bg-white/5">
              <div className="flex items-center gap-1 min-w-0">
                <span className="truncate max-w-[80px]">{playerName}</span>
                {isWinner && (
                  <Trophy className="w-3 h-3 text-[#C8F135] flex-shrink-0" />
                )}
              </div>
            </td>
            {Array.from({ length: maxSets }).map((_, i) => (
              <td key={i} className={`px-2 py-1.5 text-center text-sm font-bold ${sets[i] ? (sets[i].playerGames > sets[i].opponentGames ? 'text-white' : 'text-gray-400') : 'text-gray-600'}`}>
                {sets[i] ? (
                  <span>
                    {sets[i].playerGames}
                    {sets[i].playerTB && (
                      <sup className="text-[9px] text-gray-500 ml-px">{sets[i].playerTB}</sup>
                    )}
                  </span>
                ) : '-'}
              </td>
            ))}
            <td className="px-2 py-1.5 text-center font-bold text-lg bg-white/5">
              <span className={playerSetsWon > opponentSetsWon ? 'text-[#C8F135]' : 'text-gray-500'}>
                {playerSetsWon}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
