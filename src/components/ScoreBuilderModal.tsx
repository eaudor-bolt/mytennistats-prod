import { useEffect, useState } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

type GameFormat = {
  threeGames: boolean;
  fourGames: boolean;
  fiveGames: boolean;
  sixGames: boolean;
  supertiebreak: boolean;
  noAd: boolean;
  tiebreakAt: number;
  formatPreset: number;
};

// Identical to the 7 presets in LiveScoreModal.tsx's "Format de jeu" picker -
// same ids, same labels, same values - so a score built here means the same
// thing a live-scored match of that format would produce.
const FORMAT_PRESETS: Record<number, GameFormat> = {
  1: { threeGames: false, fourGames: false, fiveGames: false, sixGames: true, supertiebreak: false, noAd: false, tiebreakAt: 6, formatPreset: 1 },
  2: { threeGames: false, fourGames: false, fiveGames: false, sixGames: true, supertiebreak: true, noAd: false, tiebreakAt: 6, formatPreset: 2 },
  3: { threeGames: false, fourGames: true, fiveGames: false, sixGames: false, supertiebreak: true, noAd: true, tiebreakAt: 4, formatPreset: 3 },
  4: { threeGames: false, fourGames: false, fiveGames: false, sixGames: true, supertiebreak: true, noAd: true, tiebreakAt: 6, formatPreset: 4 },
  5: { threeGames: true, fourGames: false, fiveGames: false, sixGames: false, supertiebreak: true, noAd: true, tiebreakAt: 2, formatPreset: 5 },
  6: { threeGames: false, fourGames: true, fiveGames: false, sixGames: false, supertiebreak: true, noAd: true, tiebreakAt: 3, formatPreset: 6 },
  7: { threeGames: false, fourGames: false, fiveGames: true, sixGames: false, supertiebreak: true, noAd: true, tiebreakAt: 4, formatPreset: 7 },
};

const FORMAT_LABELS: Record<number, string> = {
  1: 'Format 1 - 3 Sets en 6 jeux (TB 6/6, Ad)',
  2: 'Format 2 - 2 Sets en 6 jeux (TB 6/6, Ad) + Super TB',
  3: 'Format 3 - 2 Sets en 4 jeux (TB 4/4, No Ad) + Super TB',
  4: 'Format 4 - 2 Sets en 6 jeux (TB 6/6, No Ad) + Super TB',
  5: 'Format 5 - 2 Sets en 3 jeux (TB 2/2, No Ad) + Super TB',
  6: 'Format 6 - 2 Sets en 4 jeux (TB 3/3, No Ad) + Super TB',
  7: 'Format 7 - 2 Sets en 5 jeux (TB 4/4, No Ad) + Super TB',
};

// Ported straight from LiveScoreModal.tsx's own isSetWon (as a plain function
// taking gameFormat explicitly, same porting pattern used for
// LiveMatchPage.tsx). The first branch is what makes a tiebreak-decided
// score valid: e.g. for a six-game format (tiebreakAt=6), a set stepped up
// to 7/6 or 6/7 is already a complete, correct final score on its own -
// there's no separate "tiebreak points" concept to track, the two numbers
// on the board ARE the finished result.
function isSetWon(playerGames: number, opponentGames: number, gameFormat: GameFormat): boolean {
  if (gameFormat.tiebreakAt > 0 && playerGames === gameFormat.tiebreakAt + 1 && opponentGames === gameFormat.tiebreakAt) {
    return true;
  }
  if (gameFormat.threeGames) return playerGames >= 3 && playerGames - opponentGames >= 2;
  if (gameFormat.fourGames) return playerGames >= 4 && playerGames - opponentGames >= 2;
  if (gameFormat.fiveGames) return playerGames >= 5 && playerGames - opponentGames >= 2;
  return playerGames >= 6 && playerGames - opponentGames >= 2;
}

// The highest games count a legitimate final score can ever show for this
// format - a normal margin-of-2 win can reach it, and so can the tiebreak
// path (tiebreakAt + 1, e.g. 7 for a six-game format, 4 for Format 6).
// Caps the stepper; doesn't by itself validate.
function maxGamesForFormat(gameFormat: GameFormat): number {
  const threshold = gameFormat.threeGames ? 3 : gameFormat.fourGames ? 4 : gameFormat.fiveGames ? 5 : 6;
  return Math.max(threshold, gameFormat.tiebreakAt + 1);
}

type SetEntry = {
  player: number;
  opponent: number;
};

type ScoreBuilderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (score: string, format: { game_per_set?: 3 | 4 | 6; super_tiebreak: boolean; no_ad: boolean }) => void;
  playerName: string;
  initialScore?: string;
  /**
   * True when the match ended in a retirement (set from the same form's
   * "Abandon" selector). A retiring player can stop mid-set - the last set
   * with any points in it is exempted from the "is this a real final score"
   * check (it only has to show someone ahead, not a completed set); every
   * set before it is still validated normally, since the match had to
   * legitimately get that far.
   */
  allowIncompleteLastSet?: boolean;
};

const SANE_CEILING = 30;
const emptySet = (): SetEntry => ({ player: 0, opponent: 0 });

/**
 * Parses the same score string format LiveScoreModal's generateScoreString()
 * produces: sets joined by " - ", each "player/opponent" - already the
 * complete final numbers, tiebreak or not (e.g. "7/6", never "6/6") - with
 * an optional "(tbPlayer/tbOpponent)" detail some older/live-scored matches
 * carry, which is ignored here (the two main numbers are self-sufficient),
 * or "(p/o)" with no games number at all for a supertiebreak-only 3rd set.
 * Player's number always comes first, matching that convention app-wide.
 */
function parseScoreIntoSets(score: string): SetEntry[] {
  const sets: SetEntry[] = [emptySet(), emptySet(), emptySet()];
  if (!score) return sets;

  score.split(' - ').forEach((raw, i) => {
    if (i > 2) return;

    const superTbMatch = raw.match(/^\((\d+)\/(\d+)\)$/);
    if (superTbMatch) {
      sets[i] = { player: parseInt(superTbMatch[1], 10), opponent: parseInt(superTbMatch[2], 10) };
      return;
    }

    const clean = raw.replace(/\s*\(.*?\)\s*/g, '').trim();
    const [playerRaw, opponentRaw] = clean.split('/').map((n) => parseInt(n, 10));
    sets[i] = {
      player: isNaN(playerRaw) ? 0 : playerRaw,
      opponent: isNaN(opponentRaw) ? 0 : opponentRaw,
    };
  });

  return sets;
}

function Stepper({
  value,
  onIncrement,
  onDecrement,
}: {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="inline-flex flex-col items-center">
      <button
        type="button"
        onClick={onIncrement}
        className="text-gray-400 hover:text-[#C8F135] transition-colors p-0.5"
        title="Augmenter"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
      <span className="font-bold text-white tabular-nums text-lg w-6 text-center">
        {value}
      </span>
      <button
        type="button"
        onClick={onDecrement}
        className="text-gray-400 hover:text-[#C8F135] transition-colors p-0.5"
        title="Diminuer"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ScoreBuilderModal({
  isOpen,
  onClose,
  onConfirm,
  playerName,
  initialScore,
  allowIncompleteLastSet = false,
}: ScoreBuilderModalProps) {
  const [formatPreset, setFormatPreset] = useState(2);
  const [sets, setSets] = useState<SetEntry[]>(() => parseScoreIntoSets(initialScore || ''));

  useEffect(() => {
    if (isOpen) {
      setSets(parseScoreIntoSets(initialScore || ''));
    }
  }, [isOpen, initialScore]);

  if (!isOpen) return null;

  const gameFormat = FORMAT_PRESETS[formatPreset];
  const isPlayed = (s: SetEntry) => s.player > 0 || s.opponent > 0;
  const lastPlayedIndex = sets.reduce((last, s, i) => (isPlayed(s) ? i : last), -1);
  const isNormalSet = (setIndex: number) => !(setIndex === 2 && gameFormat.supertiebreak);

  const stepGame = (setIndex: number, side: 'player' | 'opponent', delta: number) => {
    const max = isNormalSet(setIndex) ? maxGamesForFormat(gameFormat) : SANE_CEILING;
    setSets((prev) => prev.map((s, i) => {
      if (i !== setIndex) return s;
      let value = s[side] + delta;
      if (value < 0) value = max;
      else if (value > max) value = 0;
      return { ...s, [side]: value };
    }));
  };

  const validateSet = (setIndex: number, s: SetEntry): string | null => {
    if (!isPlayed(s)) return null;

    const isLenient = allowIncompleteLastSet && setIndex === lastPlayedIndex;

    if (!isNormalSet(setIndex)) {
      if (isLenient) return s.player === s.opponent ? 'Un joueur doit être devant.' : null;
      const higher = Math.max(s.player, s.opponent);
      const diff = Math.abs(s.player - s.opponent);
      if (higher < 10 || diff < 2) return 'Super TB : 10 points minimum, 2 points d\'écart.';
      return null;
    }

    if (isLenient) {
      return s.player === s.opponent ? 'Un joueur doit être devant.' : null;
    }

    if (isSetWon(s.player, s.opponent, gameFormat) || isSetWon(s.opponent, s.player, gameFormat)) return null;

    if (s.player === gameFormat.tiebreakAt && s.opponent === gameFormat.tiebreakAt) {
      return `Tie-break : continuez jusqu'à ${gameFormat.tiebreakAt + 1}/${gameFormat.tiebreakAt} ou ${gameFormat.tiebreakAt}/${gameFormat.tiebreakAt + 1}.`;
    }
    return `Score invalide pour ${FORMAT_LABELS[formatPreset].split(' - ')[0]}.`;
  };

  const setErrors = sets.map((s, i) => validateSet(i, s));
  const hasError = setErrors.some((e) => e !== null);

  const buildScoreString = (): string => {
    const parts: string[] = [];
    sets.forEach((s, i) => {
      if (!isPlayed(s)) return;
      if (!isNormalSet(i)) {
        parts.push(`(${s.player}/${s.opponent})`);
      } else {
        parts.push(`${s.player}/${s.opponent}`);
      }
    });
    return parts.join(' - ');
  };

  const previewScore = buildScoreString();

  const handleReset = () => setSets([emptySet(), emptySet(), emptySet()]);

  const handleConfirm = () => {
    if (hasError) return;
    const gamePerSet = gameFormat.threeGames ? 3 : gameFormat.fourGames ? 4 : gameFormat.fiveGames ? 5 : gameFormat.sixGames ? 6 : undefined;
    onConfirm(previewScore, {
      game_per_set: gamePerSet as 3 | 4 | 6 | undefined,
      super_tiebreak: gameFormat.supertiebreak,
      no_ad: gameFormat.noAd,
    });
    onClose();
  };

  const renderSetCell = (setIndex: number, s: SetEntry, side: 'player' | 'opponent') => (
    <td key={setIndex} className="px-1 py-2 text-center align-top">
      <Stepper
        value={s[side]}
        onIncrement={() => stepGame(setIndex, side, 1)}
        onDecrement={() => stepGame(setIndex, side, -1)}
      />
    </td>
  );

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={(e) => {
        // This overlay is rendered as a plain child of AddMatchResultModal's
        // own backdrop div (not a portal) - without stopping it here, a
        // click on THIS backdrop bubbles straight through to that outer
        // backdrop's onClick={handleClose} too, closing both modals at once
        // instead of just this one.
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-gradient-to-br from-[#0a1628] to-[#050d1a] rounded-xl shadow-2xl border border-white/10 max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Assistant de score</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
            Format de jeu
          </label>
          <select
            value={formatPreset}
            onChange={(e) => setFormatPreset(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135]"
          >
            {Object.entries(FORMAT_LABELS).map(([id, label]) => (
              <option key={id} value={id} className="bg-[#0a1628] text-white">{label}</option>
            ))}
          </select>
        </div>

        {/* Same scoreboard look as the live scoreboard / FinalScoreboard:
            Adversaire row on top, player row below, one column per set. Each
            number steps straight to the real final value (7, 6, 5, 4, 3...
            whatever this format's tiebreak makes valid) - there's no
            separate "tiebreak points" widget, the two numbers on the board
            are already the complete result. */}
        <div className="bg-gradient-to-br from-[#0f1e35]/50 to-[#0a1628]/50 rounded-xl p-2 sm:p-4 shadow-inner border border-white/5">
          <table className="w-full bg-white/5 backdrop-blur-sm rounded-lg shadow-sm overflow-hidden border border-white/10">
            <tbody>
              <tr className="border-b border-white/10">
                <td className="px-2 py-2 text-xs sm:text-sm font-semibold text-gray-200 bg-white/5 w-20 sm:w-24 truncate">
                  Adversaire
                </td>
                {sets.map((s, i) => renderSetCell(i, s, 'opponent'))}
              </tr>
              <tr>
                <td className="px-2 py-2 text-xs sm:text-sm font-semibold text-gray-200 bg-white/5 w-20 sm:w-24 truncate">
                  {playerName || 'Joueur'}
                </td>
                {sets.map((s, i) => renderSetCell(i, s, 'player'))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Per-set validation errors, in set order */}
        {setErrors.some((e) => e !== null) && (
          <div className="mt-2 space-y-1">
            {setErrors.map((error, i) => error && (
              <p key={i} className="text-xs text-red-400">Set {i + 1} : {error}</p>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3 text-center">
          Score : <span className="text-[#C8F135] font-semibold">{previewScore || 'Aucun set joué'}</span>
        </p>

        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={hasError}
            className="flex-1 px-4 py-2 bg-[#C8F135] text-[#050d1a] rounded-lg font-bold hover:bg-[#b5d930] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
