import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase, MatchResult } from '../lib/supabase';
import { MatchResultsTable } from '../components/MatchResultsTable';
import { AddMatchResultModal } from '../components/AddMatchResultModal';
import { LiveScoreModal } from '../components/LiveScoreModal';
import { ShareMatchResultsModal } from '../components/ShareMatchResultsModal';
import { Loader2, Trophy, Target, Share2, Video, ChevronDown } from 'lucide-react';
import { handleSupabaseError, retryWithBackoff } from '../utils/errorHandling';
import { useSubscription } from '../contexts/SubscriptionContext';
import { trackMatchAction, trackButtonClick } from '../utils/analytics';
import { usePlayers } from '../contexts/PlayersContext';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../hooks/useAlert';
import { deleteMatchVideos } from '../utils/s3Delete';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export function MatchesPage() {
  const { t } = useLanguage();
  const { canCreateMatchResult, canShareMatch, canShareLive, incrementUsage } = useSubscription();
  const { players } = usePlayers();
  const { showAlert, AlertComponent } = useAlert();
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState(false);
  const [isLiveScoreModalOpen, setIsLiveScoreModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchResult | null>(null);
  const [liveScoreData, setLiveScoreData] = useState<any>(null);
  const [discardLiveSessionToken, setDiscardLiveSessionToken] = useState(0);
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);
  const [radarDataTypes, setRadarDataTypes] = useState<Record<string, 'win' | 'loss'>>({});
  const [expandedRadars, setExpandedRadars] = useState<Record<string, boolean>>({});
  const justSavedLiveMatchRef = useRef(false);

  useEffect(() => {
    fetchMatchResults();
  }, []);

  const fetchMatchResults = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.error('Auth error:', authError);
        setLoading(false);
        return;
      }

      if (!user) {
        setLoading(false);
        return;
      }

      const result = await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .from('match_results')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (error) throw error;
        return data || [];
      });

      setMatchResults(result);
    } catch (error) {
      console.error('Error fetching match results:', handleSupabaseError(error as Error));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMatch = async (matchData: Omit<MatchResult, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingMatch) {
      const { error } = await supabase
        .from('match_results')
        .update({
          ...matchData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingMatch.id);

      if (error) {
        console.error('Error updating match:', error);
        throw error;
      }
      trackMatchAction('update', editingMatch.id);
    } else {
      if (!canCreateMatchResult) {
        showAlert(t('matches.premium.matchLimitReached'), { type: 'warning' });
        return;
      }

      const { error, data } = await supabase
        .from('match_results')
        .insert({
          ...matchData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating match:', error);
        throw error;
      }

      trackMatchAction('create', data?.id);
      await incrementUsage('match_result');
    }

    if (liveScoreData) {
      // The Live Score session this came from can finally be wiped now that
      // it's actually saved.
      justSavedLiveMatchRef.current = true;
      setDiscardLiveSessionToken((n) => n + 1);
    }

    await fetchMatchResults();
    setEditingMatch(null);
  };

  const handleDeleteMatch = (matchId: string) => {
    showAlert(t('matches.confirmDelete'), {
      type: 'warning',
      title: t('matches.deleteConfirmTitle'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        setDeletingMatchId(matchId);
        try {
          // Videos first, and best-effort: the S3 folder-delete looks the
          // match back up to confirm ownership, so it has to run while the
          // match_results row still exists. A failed S3 cleanup shouldn't
          // block the user from removing their own match record - it's
          // logged, not surfaced as a hard error.
          const videosDeleted = await deleteMatchVideos(matchId);
          if (!videosDeleted) {
            console.error('Error deleting match videos from S3 for match:', matchId);
          }

          const { error } = await supabase
            .from('match_results')
            .delete()
            .eq('id', matchId);

          if (error) {
            console.error('Error deleting match:', error);
            showAlert(t('matches.deleteError'), { type: 'error' });
            return;
          }

          trackMatchAction('finish', matchId, { action_type: 'delete' });
          await fetchMatchResults();
        } finally {
          setDeletingMatchId(null);
        }
      },
    });
  };

  const handleEditMatch = (match: MatchResult) => {
    setEditingMatch(match);
    setIsAddMatchModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddMatchModalOpen(false);
    setEditingMatch(null);

    const cameFromLiveScore = !!liveScoreData;
    const wasJustSaved = justSavedLiveMatchRef.current;
    justSavedLiveMatchRef.current = false;
    setLiveScoreData(null);

    if (cameFromLiveScore && !wasJustSaved) {
      // Cancelled out of the Add Match modal without saving - go back to
      // Live Score with the match exactly as it was.
      setIsLiveScoreModalOpen(true);
    }
  };

  const totalMatches = matchResults.length;
  const wins = matchResults.filter(m => m.result === 'win').length;
  const losses = matchResults.filter(m => m.result === 'loss').length;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  // Helper function to determine if a match was won based on score
  const isMatchWon = (score: string): boolean => {
    if (!score) return false;

    // Parse score to determine winner
    // Format examples: "6/4 - 6/3", "6/4 - 2/6 - (10/5)", "6/7 - 6/4 - (10/8)"
    const sets = score.split(' - ');
    let setsWon = 0;
    let setsLost = 0;

    sets.forEach(set => {
      const isTiebreak = set.includes('(');
      const cleanSet = set.replace(/[()]/g, '');
      const [playerScore, opponentScore] = cleanSet.split('/').map(s => parseInt(s.trim()));

      if (!isNaN(playerScore) && !isNaN(opponentScore)) {
        if (playerScore > opponentScore) {
          setsWon++;
        } else {
          setsLost++;
        }
      }
    });

    return setsWon > setsLost;
  };

  // Calculate per-opponent statistics
  const playerStats = useMemo(() => {
    // Group matches by opponent name
    const opponentGroups = matchResults.reduce((acc, match) => {
      const opponentName = match.player_name || 'Unknown Opponent';
      if (!acc[opponentName]) {
        acc[opponentName] = [];
      }
      acc[opponentName].push(match);
      return acc;
    }, {} as Record<string, MatchResult[]>);

    // Calculate stats for each opponent
    return Object.entries(opponentGroups).map(([opponentName, matches]) => {
      const opponentWins = matches.filter(m => isMatchWon(m.score)).length;
      const opponentLosses = matches.length - opponentWins;
      const opponentTotal = matches.length;
      const opponentWinRate = opponentTotal > 0 ? Math.round((opponentWins / opponentTotal) * 100) : 0;

      // Calculate radar data from all matches for this player
      const calculateRadarStats = () => {
        let totalWins = { forehand: 0, backhand: 0, service: 0, volley: 0, return: 0, opponent: 0 };
        let totalLosses = { forehand: 0, backhand: 0, service: 0, volley: 0, return: 0, opponent: 0 };

        console.log(`[Radar Stats] Calculating for ${opponentName} with ${matches.length} matches`);

        matches.forEach((match, matchIdx) => {
          // Handle both parsed and stringified scoring_history
          let scoringHistory = match.scoring_history;
          if (typeof scoringHistory === 'string') {
            try {
              scoringHistory = JSON.parse(scoringHistory);
            } catch (e) {
              console.error('Error parsing scoring_history:', e);
              return;
            }
          }

          if (scoringHistory && Array.isArray(scoringHistory) && scoringHistory.length > 0) {
            console.log(`[Match ${matchIdx + 1}] Processing ${scoringHistory.length} points`);

            scoringHistory.forEach((point: any) => {
              // Parse toggleValue which has format "skill: action" (e.g., "forehand: Gagne" or "service: Faute")
              const toggleValue = point.toggleValue || '';
              const parts = toggleValue.split(':').map((p: string) => p.trim().toLowerCase());

              if (parts.length === 2) {
                const skill = parts[0];
                const action = parts[1];
                const isWin = action === 'gagne' || action === 'winner';

                if (skill.includes('forehand') || skill.includes('coup droit') || skill === 'cd') {
                  if (isWin) totalWins.forehand++; else totalLosses.forehand++;
                } else if (skill.includes('backhand') || skill.includes('revers') || skill === 'r') {
                  if (isWin) totalWins.backhand++; else totalLosses.backhand++;
                } else if (skill.includes('service') || skill.includes('serve') || skill === 's') {
                  if (isWin) totalWins.service++; else totalLosses.service++;
                } else if (skill.includes('volley') || skill.includes('vollée') || skill === 'v') {
                  if (isWin) totalWins.volley++; else totalLosses.volley++;
                } else if (skill.includes('return') || skill.includes('retour') || skill === 'ret') {
                  if (isWin) totalWins.return++; else totalLosses.return++;
                } else if (skill.includes('opponent') || skill.includes('adversaire') || skill === 'opp') {
                  if (isWin) totalWins.opponent++; else totalLosses.opponent++;
                }
              }
            });
          } else {
            console.log(`[Match ${matchIdx + 1}] No scoring history available`);
          }
        });

        console.log('[Radar Stats] Total wins:', totalWins);
        console.log('[Radar Stats] Total losses:', totalLosses);

        // Calculate percentages
        const calculatePercentage = (wins: number, losses: number) => {
          const total = wins + losses;
          return total > 0 ? Math.round((wins / total) * 100) : 0;
        };

        const calculateLossPercentage = (wins: number, losses: number) => {
          const total = wins + losses;
          return total > 0 ? Math.round((losses / total) * 100) : 0;
        };

        const radarData = {
          win: {
            forehand: calculatePercentage(totalWins.forehand, totalLosses.forehand),
            backhand: calculatePercentage(totalWins.backhand, totalLosses.backhand),
            service: calculatePercentage(totalWins.service, totalLosses.service),
            volley: calculatePercentage(totalWins.volley, totalLosses.volley),
            return: calculatePercentage(totalWins.return, totalLosses.return),
            opponent: calculatePercentage(totalWins.opponent, totalLosses.opponent),
          },
          loss: {
            forehand: calculateLossPercentage(totalWins.forehand, totalLosses.forehand),
            backhand: calculateLossPercentage(totalWins.backhand, totalLosses.backhand),
            service: calculateLossPercentage(totalWins.service, totalLosses.service),
            volley: calculateLossPercentage(totalWins.volley, totalLosses.volley),
            return: calculateLossPercentage(totalWins.return, totalLosses.return),
            opponent: calculateLossPercentage(totalWins.opponent, totalLosses.opponent),
          }
        };

        console.log('[Radar Stats] Final percentages:', radarData);
        return radarData;
      };

      return {
        playerId: opponentName,
        playerName: opponentName,
        matches: opponentTotal,
        wins: opponentWins,
        losses: opponentLosses,
        winRate: opponentWinRate,
        radarData: calculateRadarStats()
      };
    }).sort((a, b) => b.matches - a.matches); // Sort by most matches
  }, [matchResults]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050d1a] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#C8F135] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050d1a]">
      <AlertComponent />
      {/* Hero Section */}
      <section className="relative pt-16 pb-8 lg:pt-20 lg:pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050d1a] via-[#071428]/30 to-[#050d1a]" />

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[300px] bg-[#1A6FC4]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[400px] bg-[#C8F135]/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center gap-2 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar w-5 h-5 text-[#C8F135]"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>
            <span className="text-[#C8F135] text-sm font-medium tracking-widest uppercase">
              {t('matches.hero.eyebrow')}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6">
                {t('matches.hero.title1')}<br />
                <span className="text-[#C8F135]">{t('matches.hero.title2')}</span>
              </h1>

              <p className="text-lg text-gray-300 max-w-2xl leading-relaxed">
                {t('matches.hero.subtitle')}
              </p>
            </div>

            <button
              onClick={() => {
                if (!canShareLive) {
                  showAlert(t('matches.premium.liveShareGate'), { type: 'warning' });
                  return;
                }
                trackMatchAction('share', undefined, { share_type: 'live' });
                setIsLiveScoreModalOpen(true);
                incrementUsage('live_share');
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1A6FC4] text-white rounded-lg text-sm font-medium hover:bg-[#1A6FC4]/80 transition-all hover:scale-105 shadow-lg shadow-[#1A6FC4]/20 shrink-0"
            >
              <Trophy className="w-4 h-4" />
              <span>{t('matches.hero.liveScoreButton')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Summary Section */}
      {playerStats.length > 0 && (
        <section className="relative pb-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight mb-6">
              {t('matches.summary.title')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {playerStats.map((player) => (
                <div key={player.playerId} className="group relative p-6 rounded-xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
                  <div className="mb-4 pb-3 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">{player.playerName}</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="text-4xl font-black text-[#C8F135] tabular-nums">
                        {player.matches}
                      </div>
                      <Target className="w-9 h-9 text-[#C8F135]" />
                    </div>
                    <h4 className="text-sm font-semibold text-white uppercase tracking-wide">
                      {t('matches.summary.matchResults')}
                    </h4>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-green-400 font-semibold">{player.wins} {t('matches.summary.winAbbr')}</span>
                      <span className="text-red-400 font-semibold">{player.losses} {t('matches.summary.lossAbbr')}</span>
                    </div>
                    {player.matches > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-400">{t('matches.summary.winRate')}</span>
                          <span className="font-bold text-[#C8F135]">{player.winRate}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2 mb-4">
                          <div
                            className="bg-[#C8F135] h-2 rounded-full transition-all duration-500"
                            style={{ width: `${player.winRate}%` }}
                          />
                        </div>

                        {/* Radar Chart - Accordion on mobile, always visible on desktop */}
                        <div className="w-full">
                          {/* Mobile Accordion Toggle */}
                          <button
                            onClick={() => setExpandedRadars(prev => ({ ...prev, [player.playerId]: !prev[player.playerId] }))}
                            className="lg:hidden w-full flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                          >
                            <span className="text-xs font-medium text-gray-300">{t('matches.radar.toggleLabel')}</span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedRadars[player.playerId] ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Desktop: always visible / Mobile: collapsible */}
                          <div className={`lg:block ${expandedRadars[player.playerId] ? 'block' : 'hidden'}`}>
                            <div className="flex justify-center gap-2 mb-4 mt-3 lg:mt-0">
                              <button
                                onClick={() => {
                                  setRadarDataTypes(prev => ({ ...prev, [player.playerId]: 'win' }));
                                  trackButtonClick('radar_toggle_win', 'matches_page');
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  (radarDataTypes[player.playerId] || 'win') === 'win'
                                    ? 'bg-[#C8F135] text-black'
                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                              >
                                {t('matches.win')}
                              </button>
                              <button
                                onClick={() => {
                                  setRadarDataTypes(prev => ({ ...prev, [player.playerId]: 'loss' }));
                                  trackButtonClick('radar_toggle_loss', 'matches_page');
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  (radarDataTypes[player.playerId] || 'win') === 'loss'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                              >
                                {t('matches.loss')}
                              </button>
                            </div>
                            <div className="w-full h-64 flex items-center justify-center">
                              <Radar
                                data={{
                                  labels: [
                                    t('matches.radar.axis.forehand'),
                                    t('matches.radar.axis.backhand'),
                                    t('matches.radar.axis.service'),
                                    t('matches.radar.axis.volley'),
                                    t('matches.radar.axis.return'),
                                    t('matches.radar.axis.opponent'),
                                  ],
                                  datasets: [
                                    {
                                      label: (radarDataTypes[player.playerId] || 'win') === 'win' ? t('matches.radar.winPercent') : t('matches.radar.lossPercent'),
                                      data: (radarDataTypes[player.playerId] || 'win') === 'win' ? [
                                        player.radarData.win.forehand,
                                        player.radarData.win.backhand,
                                        player.radarData.win.service,
                                        player.radarData.win.volley,
                                        player.radarData.win.return,
                                        player.radarData.win.opponent,
                                      ] : [
                                        player.radarData.loss.forehand,
                                        player.radarData.loss.backhand,
                                        player.radarData.loss.service,
                                        player.radarData.loss.volley,
                                        player.radarData.loss.return,
                                        player.radarData.loss.opponent,
                                      ],
                                      backgroundColor: (radarDataTypes[player.playerId] || 'win') === 'win' ? 'rgba(200, 241, 53, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                      borderColor: (radarDataTypes[player.playerId] || 'win') === 'win' ? 'rgba(200, 241, 53, 1)' : 'rgba(239, 68, 68, 1)',
                                      borderWidth: 2,
                                      pointBackgroundColor: (radarDataTypes[player.playerId] || 'win') === 'win' ? 'rgba(200, 241, 53, 1)' : 'rgba(239, 68, 68, 1)',
                                      pointBorderColor: '#fff',
                                      pointHoverBackgroundColor: '#fff',
                                      pointHoverBorderColor: (radarDataTypes[player.playerId] || 'win') === 'win' ? 'rgba(200, 241, 53, 1)' : 'rgba(239, 68, 68, 1)',
                                    }
                                  ]
                                }}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: true,
                                  scales: {
                                    r: {
                                      beginAtZero: true,
                                      max: 100,
                                      ticks: {
                                        stepSize: 20,
                                        color: 'rgba(255, 255, 255, 0.5)',
                                        backdropColor: 'transparent',
                                        font: { size: 10 }
                                      },
                                      grid: {
                                        color: 'rgba(255, 255, 255, 0.1)',
                                      },
                                      pointLabels: {
                                        color: 'rgba(255, 255, 255, 0.7)',
                                        font: { size: 11, weight: '600' }
                                      },
                                      angleLines: {
                                        color: 'rgba(255, 255, 255, 0.1)',
                                      }
                                    }
                                  },
                                  plugins: {
                                    legend: {
                                      display: false
                                    },
                                    tooltip: {
                                      backgroundColor: 'rgba(5, 13, 26, 0.9)',
                                      titleColor: (radarDataTypes[player.playerId] || 'win') === 'win' ? '#C8F135' : '#EF4444',
                                      bodyColor: '#fff',
                                      borderColor: (radarDataTypes[player.playerId] || 'win') === 'win' ? 'rgba(200, 241, 53, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                                      borderWidth: 1,
                                      padding: 10,
                                      displayColors: false,
                                      callbacks: {
                                        label: (context) => {
                                          const template = (radarDataTypes[player.playerId] || 'win') === 'win'
                                            ? t('matches.radar.tooltipWin')
                                            : t('matches.radar.tooltipLoss');
                                          return template.replace('{pct}', String(context.parsed.r));
                                        }
                                      }
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Match Results Table */}
      <section className="relative pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <MatchResultsTable
            matchResults={matchResults}
            onAddMatch={() => {
              trackMatchAction('create', undefined, { action_type: 'open_modal' });
              setIsAddMatchModalOpen(true);
            }}
            onEditMatch={handleEditMatch}
            onDeleteMatch={handleDeleteMatch}
            deletingMatchId={deletingMatchId}
            onShareResults={() => {
              trackMatchAction('share', undefined, { share_type: 'results' });
              setIsShareModalOpen(true);
            }}
            onShareIndividual={async (matchId) => {
              if (!canShareMatch) {
                showAlert(t('matches.premium.shareLimitReached'), { type: 'warning' });
                return;
              }
              trackMatchAction('share', undefined, { share_type: 'individual' });
              await incrementUsage('share');
              // Nothing else marks a match as "shared" - Settings -> Shared
              // Links reads this to list /shared-game/ links at all.
              const { error } = await supabase
                .from('match_results')
                .update({ shared_at: new Date().toISOString() })
                .eq('id', matchId);
              if (error) {
                console.error('Error marking match as shared:', error);
              }
            }}
          />
        </div>
      </section>


      {/* Add/Edit Match Modal */}
      <AddMatchResultModal
        isOpen={isAddMatchModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveMatch}
        editingMatch={editingMatch}
        initialData={liveScoreData}
      />

      {/* Live Score Modal */}
      <LiveScoreModal
        isOpen={isLiveScoreModalOpen}
        onClose={() => setIsLiveScoreModalOpen(false)}
        onMatchSaved={() => {
          setIsLiveScoreModalOpen(false);
          fetchMatchResults();
        }}
        onMatchFinished={(matchData) => {
          setLiveScoreData(matchData);
          setIsAddMatchModalOpen(true);
        }}
        discardSessionToken={discardLiveSessionToken}
      />

      {/* Share Results Modal */}
      <ShareMatchResultsModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        matchResults={matchResults}
      />
    </div>
  );
}
