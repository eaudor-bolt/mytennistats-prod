import { useState, useMemo, useEffect } from 'react';
import { Plus, CreditCard as Edit, Trash2, BarChart3, Trophy, Share2 } from 'lucide-react';
import { MatchResult } from '../lib/supabase';
import { MatchStatsModal } from './MatchStatsModal';
import { useAlert } from '../hooks/useAlert';
import { MiniMatchScoreboard } from './MiniMatchScoreboard';

type MatchResultsTableProps = {
  matchResults: MatchResult[];
  onAddMatch: () => void;
  onEditMatch: (match: MatchResult) => void;
  onDeleteMatch: (matchId: string) => void;
  onLiveScore?: () => void;
  onShareResults?: () => void;
  onShareIndividual?: () => Promise<void>;
};

export function MatchResultsTable({ matchResults, onAddMatch, onEditMatch, onDeleteMatch, onLiveScore, onShareResults, onShareIndividual }: MatchResultsTableProps) {
  const { showAlert, AlertComponent } = useAlert();
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  const uniquePlayers = useMemo(() => {
    const players = new Set(matchResults.map(match => match.player_name));
    return Array.from(players).sort();
  }, [matchResults]);

  // Initialize selectedPlayers with all unique players when uniquePlayers changes
  useEffect(() => {
    if (uniquePlayers.length > 0 && selectedPlayers.length === 0) {
      setSelectedPlayers([...uniquePlayers]);
    }
  }, [uniquePlayers]);

  const togglePlayerFilter = (playerName: string) => {
    setSelectedPlayers(prev =>
      prev.includes(playerName)
        ? prev.filter(p => p !== playerName)
        : [...prev, playerName]
    );
  };

  const toggleAllPlayers = () => {
    if (selectedPlayers.length === uniquePlayers.length) {
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers([...uniquePlayers]);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedMatches = useMemo(() => {
    // If no players are selected, show nothing
    if (selectedPlayers.length === 0) {
      return [];
    }

    // Filter by selected players
    let filtered = matchResults.filter(match =>
      selectedPlayers.includes(match.player_name)
    );

    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'player':
          aValue = a.player_name.toLowerCase();
          bValue = b.player_name.toLowerCase();
          break;
        case 'tournament':
          aValue = a.tournament_name.toLowerCase();
          bValue = b.tournament_name.toLowerCase();
          break;
        case 'score':
          aValue = a.score.toLowerCase();
          bValue = b.score.toLowerCase();
          break;
        case 'classement':
          const classementOrder = { 'NC': 0, '40': 1, '30': 2, '15': 3 };
          aValue = classementOrder[a.classement] || 0;
          bValue = classementOrder[b.classement] || 0;
          break;
        case 'forehand':
        case 'backhand':
        case 'serve':
        case 'return':
          const impressionOrder = { 'bad': 0, 'good': 1, 'great': 2 };
          aValue = impressionOrder[a.impressions[sortField as keyof typeof a.impressions]] || 0;
          bValue = impressionOrder[b.impressions[sortField as keyof typeof b.impressions]] || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [matchResults, sortField, sortDirection, selectedPlayers]);

  const renderEmoji = (mood: 'bad' | 'good' | 'great') => {
    switch (mood) {
      case 'great':
        return <span className="text-2xl" title="Excellent">👍</span>;
      case 'good':
        return <span className="text-2xl" title="Bon">😐</span>;
      case 'bad':
        return <span className="text-2xl" title="Mauvais">👎</span>;
    }
  };

  const getMatchResult = (score: string) => {
    if (!score) return 'unknown';

    const sets = score.split(' - ');
    let playerSets = 0;
    let opponentSets = 0;

    sets.forEach(set => {
      // Super tiebreak decider set, stored as "(10/5)" with no games score
      // of its own - stripping parens like the regular sets below would
      // leave nothing to split on and silently drop its winner.
      const superTiebreakMatch = set.match(/^\((\d+)\/(\d+)\)$/);
      if (superTiebreakMatch) {
        const player = parseInt(superTiebreakMatch[1]);
        const opponent = parseInt(superTiebreakMatch[2]);
        if (player > opponent) playerSets++;
        else if (opponent > player) opponentSets++;
        return;
      }

      const cleanSet = set.replace(/\s*\(.*?\)\s*/g, '');
      const [player, opponent] = cleanSet.split('/').map(Number);
      if (player > opponent) {
        playerSets++;
      } else if (opponent > player) {
        opponentSets++;
      }
    });

    if (playerSets > opponentSets) return 'win';
    if (opponentSets > playerSets) return 'loss';
    return 'unknown';
  };

  const renderScoreWithTiebreak = (score: string) => {
    if (!score) return <span>-</span>;

    const sets = score.split(' - ');

    return (
      <div className="flex items-center gap-1">
        {sets.map((set, index) => {
          // Check if this is a super tiebreak (just parentheses with score, e.g., "(6/10)")
          if (set.match(/^\(\d+\/\d+\)$/)) {
            return (
              <span key={index} className="inline-flex items-center">
                {set}
                {index < sets.length - 1 && <span className="mx-1">-</span>}
              </span>
            );
          }

          // Extract tiebreak score if present (e.g., "6/7 (5)" or "7/6 (3)")
          const tiebreakMatch = set.match(/\((\d+)\/(\d+)\)/);
          const tiebreakScore = tiebreakMatch ? tiebreakMatch[1] : null;
          const cleanSet = set.replace(/\s*\(.*?\)\s*/g, '').trim();

          return (
            <span key={index} className="inline-flex items-center">
              {cleanSet}
              {tiebreakScore && (
                <sup className="text-[10px] ml-0.5">{tiebreakScore}</sup>
              )}
              {index < sets.length - 1 && <span className="mx-1">-</span>}
            </span>
          );
        })}
      </div>
    );
  };

  const handleShare = async (matchId: string) => {
    const url = `${window.location.origin}/match-history/${matchId}`;
    try {
      if (onShareIndividual) {
        await onShareIndividual();
      }
      await navigator.clipboard.writeText(url);
      showAlert('Lien copié dans le presse-papiers! Partagez-le pour montrer les résultats de ce match.', {
        type: 'success',
        title: 'Partage créé',
        link: url
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      showAlert(`Erreur lors de la copie du lien`);
    }
  };

  return (
    <>
      <AlertComponent />
      <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-white/8 flex items-center justify-between">
        <h3 className="text-lg sm:text-xl font-bold text-white">Match List</h3>
        <div className="flex items-center gap-2">
          {onLiveScore && (
            <button
              onClick={onLiveScore}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#1A6FC4] text-white rounded-lg text-sm font-medium hover:bg-[#1A6FC4]/80 transition-all hover:scale-105 shadow-lg shadow-[#1A6FC4]/20"
            >
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Live Score</span>
            </button>
          )}
          {onShareResults && matchResults.length > 0 && (
            <button
              onClick={onShareResults}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-all border border-white/10"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
          <button
            onClick={onAddMatch}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#C8F135] text-[#050d1a] rounded-lg text-sm font-bold hover:bg-white transition-all hover:scale-105 shadow-lg shadow-[#C8F135]/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Match</span>
          </button>
        </div>
      </div>

      {uniquePlayers.length > 0 && (
        <div className="px-4 sm:px-6 py-4 bg-white/5 border-b border-white/8">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-300">Filter by Player</h4>
            <button
              onClick={toggleAllPlayers}
              className="text-xs text-[#C8F135] hover:text-white font-medium transition-colors"
            >
              {selectedPlayers.length === uniquePlayers.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {uniquePlayers.map(playerName => (
              <label
                key={playerName}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-all"
              >
                <input
                  type="checkbox"
                  checked={selectedPlayers.includes(playerName)}
                  onChange={() => togglePlayerFilter(playerName)}
                  className="w-4 h-4 text-[#C8F135] border-white/20 bg-white/5 rounded focus:ring-[#C8F135]"
                />
                <span className="text-sm font-medium text-gray-300">{playerName}</span>
              </label>
            ))}
          </div>
          {selectedPlayers.length > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              Showing {filteredAndSortedMatches.length} match{filteredAndSortedMatches.length !== 1 ? 'es' : ''} of {matchResults.length}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th
                onClick={() => handleSort('date')}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors"
              >
                Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => handleSort('player')}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors"
              >
                Player {sortField === 'player' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => handleSort('tournament')}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors"
              >
                Tournament {sortField === 'tournament' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => handleSort('score')}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors"
              >
                Score {sortField === 'score' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => handleSort('classement')}
                className="px-4 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors"
              >
                Ranking {sortField === 'classement' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Impressions
                <div className="flex items-center justify-center gap-3 mt-2 text-[10px] font-normal">
                  <span
                    onClick={() => handleSort('forehand')}
                    className="cursor-pointer hover:text-white"
                  >
                    FH {sortField === 'forehand' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </span>
                  <span
                    onClick={() => handleSort('backhand')}
                    className="cursor-pointer hover:text-white"
                  >
                    BH {sortField === 'backhand' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </span>
                  <span
                    onClick={() => handleSort('serve')}
                    className="cursor-pointer hover:text-white"
                  >
                    Serve {sortField === 'serve' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </span>
                  <span
                    onClick={() => handleSort('return')}
                    className="cursor-pointer hover:text-white"
                  >
                    Return {sortField === 'return' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredAndSortedMatches.map((match) => {
              const matchResult = getMatchResult(match.score);
              const rowClass = matchResult === 'win'
                ? 'bg-green-500/10 hover:bg-green-500/15 border-l-2 border-l-green-400'
                : matchResult === 'loss'
                ? 'bg-red-500/10 hover:bg-red-500/15 border-l-2 border-l-red-400'
                : 'hover:bg-white/5 border-l-2 border-l-transparent';

              return (
                <tr key={match.id} className={`${rowClass} transition-all duration-200`}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                    <div className="flex items-center gap-2">
                      <span>{new Date(match.date).toLocaleDateString('fr-FR')}</span>
                      <button
                        onClick={() => handleShare(match.id)}
                        className="p-1 text-gray-400 hover:text-[#C8F135] hover:bg-white/10 rounded transition-all"
                        title="Share link"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                    <div className="flex items-center gap-2">
                      <span>{match.player_name}</span>
                      {match.scoring_history && match.scoring_history.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedMatch(match);
                            setIsStatsModalOpen(true);
                          }}
                          className="p-1 text-[#C8F135] hover:bg-[#C8F135]/20 rounded transition-all"
                          title="Statistics"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {match.tournament_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <MiniMatchScoreboard
                      score={match.score}
                      playerName={match.player_name}
                      opponentName="Adversaire"
                      isWinner={matchResult === 'win'}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold text-[#C8F135]">
                    {match.classement}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-3">
                      {renderEmoji(match.impressions.forehand)}
                      {renderEmoji(match.impressions.backhand)}
                      {renderEmoji(match.impressions.serve)}
                      {renderEmoji(match.impressions.return)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEditMatch(match)}
                        className="p-1 text-[#1A6FC4] hover:bg-[#1A6FC4]/20 rounded transition-all"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteMatch(match.id)}
                        className="p-1 text-red-400 hover:bg-red-400/20 rounded transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredAndSortedMatches.length === 0 && (
        <div className="p-8 text-center text-gray-400">
          No matches recorded. Click "Add Match" to add your first match.
        </div>
      )}

      <MatchStatsModal
        isOpen={isStatsModalOpen}
        onClose={() => {
          setIsStatsModalOpen(false);
          setSelectedMatch(null);
        }}
        match={selectedMatch}
      />
    </div>
    </>
  );
}
