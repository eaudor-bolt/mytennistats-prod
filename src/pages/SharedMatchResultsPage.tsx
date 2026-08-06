import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase, MatchResult } from '../lib/supabase';
import { Loader2, Share2, BarChart3 } from 'lucide-react';
import { MatchStatsModal } from '../components/MatchStatsModal';
import { MiniMatchScoreboard } from '../components/MiniMatchScoreboard';

type SharedMatchResultsPageProps = {
  shareId: string;
};

export function SharedMatchResultsPage({ shareId }: SharedMatchResultsPageProps) {
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const viewCountedRef = useRef(false);

  useEffect(() => {
    loadSharedResults();

    // Count this as one "view" of the shared link - once per page load, not
    // tied to whether the fetch above succeeds (a load error doesn't mean
    // the link wasn't opened).
    if (!viewCountedRef.current) {
      viewCountedRef.current = true;
      supabase.rpc('increment_shared_result_views', { p_share_id: shareId })
        .then(({ error }) => { if (error) console.error('Error recording view:', error); });
    }
  }, [shareId]);

  const loadSharedResults = async () => {
    setLoading(true);
    setError(null);

    try {
      // One RPC instead of two table reads: neither shared_match_results nor
      // match_results is readable by anonymous visitors. The function resolves
      // the share and its matches, and applies the is_active / expires_at
      // checks server-side.
      const { data: shareData, error: shareError } = await supabase
        .rpc('get_shared_match_results', { p_share_id: shareId });

      if (shareError) {
        console.error('Error loading share:', shareError);
        setError('Partage introuvable ou expiré');
        setLoading(false);
        return;
      }

      if (!shareData) {
        console.log('No active share found for ID:', shareId);
        setError('Partage introuvable ou expiré');
        setLoading(false);
        return;
      }

      setPlayerNames(shareData.player_names || []);
      setMatchResults((shareData.matches || []) as MatchResult[]);
    } catch (err) {
      console.error('Error loading shared results:', err);
      setError('Erreur lors du chargement');
    } finally {
      setLoading(false);
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

  const sortedMatches = useMemo(() => {
    if (!sortField) return matchResults;

    return [...matchResults].sort((a, b) => {
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
  }, [matchResults, sortField, sortDirection]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#050d1a] via-[#071428] to-[#050d1a] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#C8F135] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1e35] to-[#0a0e1a] flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <Share2 className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Partage introuvable</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1e35] to-[#0a0e1a] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with branding */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#C8F135] flex items-center justify-center">
              <img src="/tennis-ball.svg" alt="Tennis" className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold">
              <span className="text-white">my</span>
              <span className="text-[#C8F135]">TenniStats</span>
            </h1>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-[#C8F135]/20 to-[#C8F135]/10 p-6 sm:p-8 border-b border-white/10">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-[#C8F135]/20 rounded-full flex items-center justify-center border border-[#C8F135]/30">
                <Share2 className="w-8 h-8 text-[#C8F135]" />
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-2">
              Résultats Partagés
            </h2>
            <p className="text-gray-300 text-center text-lg">
              {playerNames.join(', ')}
            </p>
          </div>

          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                    <th
                      onClick={() => handleSort('date')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => handleSort('player')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      Player {sortField === 'player' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => handleSort('tournament')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      Tournoi {sortField === 'tournament' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => handleSort('score')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      Score {sortField === 'score' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => handleSort('classement')}
                      className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      Classement {sortField === 'classement' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Impressions
                      <div className="flex items-center justify-center gap-3 mt-2 text-[10px] font-normal">
                        <span
                          onClick={() => handleSort('forehand')}
                          className="cursor-pointer hover:text-gray-200"
                        >
                          FH {sortField === 'forehand' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </span>
                        <span
                          onClick={() => handleSort('backhand')}
                          className="cursor-pointer hover:text-gray-200"
                        >
                          BH {sortField === 'backhand' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </span>
                        <span
                          onClick={() => handleSort('serve')}
                          className="cursor-pointer hover:text-gray-200"
                        >
                          Serve {sortField === 'serve' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </span>
                        <span
                          onClick={() => handleSort('return')}
                          className="cursor-pointer hover:text-gray-200"
                        >
                          Return {sortField === 'return' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sortedMatches.map((match) => {
                    const matchResult = getMatchResult(match.score);
                    const rowClass = matchResult === 'win'
                      ? 'bg-green-500/10 hover:bg-green-500/20'
                      : matchResult === 'loss'
                      ? 'bg-red-500/10 hover:bg-red-500/20'
                      : 'hover:bg-white/5';

                    return (
                      <tr key={match.id} className={`${rowClass} transition-colors`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedMatch(match);
                                setIsStatsModalOpen(true);
                              }}
                              className="p-1 text-[#C8F135] hover:bg-[#C8F135]/10 rounded transition-colors"
                              title="Statistiques"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                          {new Date(match.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                          {match.player_name}
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
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold text-white">
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {sortedMatches.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                Aucun match trouvé
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-[#C8F135]/10 to-[#C8F135]/5 px-6 sm:px-8 py-4 border-t border-white/10">
            <p className="text-center text-sm text-gray-400">
              Shared Match Results
            </p>
          </div>
        </div>
      </div>

      <MatchStatsModal
        isOpen={isStatsModalOpen}
        onClose={() => {
          setIsStatsModalOpen(false);
          setSelectedMatch(null);
        }}
        match={selectedMatch}
      />
    </div>
  );
}
