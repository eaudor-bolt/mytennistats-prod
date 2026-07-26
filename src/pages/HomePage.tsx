import { useEffect, useState } from 'react';
import { Trophy, Calendar, Video, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CourtBackground, { CourtLinePattern } from '../components/landing/CourtBackground';

interface PlayerStats {
  playerId: string;
  playerName: string;
  tournaments: number;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  videos: number;
}

function AnimatedStatCard({
  value,
  title,
  description,
  icon: Icon
}: {
  value: number;
  title: string;
  description: string;
  icon: any;
}) {
  return (
    <div className="flex flex-col gap-2 p-6 border border-white/8 rounded-2xl bg-white/3 hover:bg-white/5 hover:border-[#C8F135]/30 transition-all duration-400 group w-4/5 mx-auto">
      <div className="text-white font-bold text-base">{title}</div>
      <div className="flex items-center justify-center gap-3 mb-2">
        <div className="text-5xl lg:text-6xl font-black text-[#C8F135] tabular-nums tracking-tight">
          {value}
        </div>
        <Icon className="w-12 h-12 lg:w-14 lg:h-14 text-[#C8F135]" />
      </div>

      <div className="text-gray-400 text-sm leading-relaxed">{description}</div>
    </div>
  );
}

function PlayerStatBox({
  value,
  title,
  description,
  icon: Icon
}: {
  value: number;
  title: string;
  description: string;
  icon: any;
}) {
  return (
    <div className="group relative p-6 rounded-xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
      <h4 className="text-sm font-bold text-white uppercase tracking-wide mb-1">{title}</h4>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-4xl font-black text-[#C8F135] tabular-nums">
          {value}
        </div>
        <Icon className="w-9 h-9 text-[#C8F135]" />
      </div>

      <p className="text-xs text-gray-400">{description}</p>
    </div>
  );
}

function MatchResultsBox({
  matches,
  wins,
  losses,
  winRate
}: {
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
}) {
  return (
    <div className="group relative p-6 rounded-xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
      <div className="space-y-2">
         <h4 className="text-sm font-bold text-white uppercase tracking-wide">Match Results</h4>
        <div className="flex items-center gap-3 mb-1">
          <div className="text-4xl font-black text-[#C8F135] tabular-nums">
            {matches}
          </div>
          <Calendar className="w-9 h-9 text-[#C8F135]" />
        </div>
       
        <div className="flex items-center gap-3 text-sm">
          <span className="text-green-400 font-semibold">{wins} W</span>
          <span className="text-red-400 font-semibold">{losses} L</span>
        </div>
        {matches > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">Win Rate</span>
              <span className="font-bold text-[#C8F135]">{winRate}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-[#C8F135] h-2 rounded-full transition-all duration-500"
                style={{ width: `${winRate}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayerStats();
  }, []);

  const loadPlayerStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [playersResult, tournamentsResult, matchesResult, videosResult] = await Promise.all([
        supabase
          .from('user_players')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('tournament_registrations')
          .select('player_id', { count: 'exact' })
          .eq('user_id', user.id),
        supabase
          .from('match_results')
          .select('player_name, score')
          .eq('user_id', user.id),
        supabase
          .from('videos')
          .select('player_name', { count: 'exact' })
          .eq('user_id', user.id),
      ]);

      if (playersResult.error) throw playersResult.error;
      const players = playersResult.data;

      if (!players || players.length === 0) {
        setLoading(false);
        return;
      }

      const tournamentsByPlayer = new Map<string, number>();
      tournamentsResult.data?.forEach(reg => {
        const count = tournamentsByPlayer.get(reg.player_id) || 0;
        tournamentsByPlayer.set(reg.player_id, count + 1);
      });

      const statsPromises = players.map(async (player) => {
        const fullName = `${player.first_name} ${player.last_name}`.trim();

        const tournaments = tournamentsByPlayer.get(player.id) || 0;
        // match_results.player_name is saved as just the first name
        // (AddMatchResultModal's player dropdown uses player.first_name as
        // the option value), while videos.player_name is saved as the full
        // "first last" name - match each against its actual stored format
        // instead of a fuzzy substring check against the full name.
        const matches = matchesResult.data?.filter(m =>
          m.player_name.trim().toLowerCase() === player.first_name.trim().toLowerCase()
        ) || [];
        const videos = videosResult.data?.filter(v =>
          v.player_name.trim().toLowerCase() === fullName.toLowerCase()
        ).length || 0;

        let wins = 0;
        let losses = 0;

        matches.forEach(match => {
          if (match.score) {
            const sets = match.score.split(' - ').map((s: string) => s.trim());
            let setsWon = 0;
            let setsLost = 0;

            sets.forEach((set: string) => {
              const clean = set.replace(/[()]/g, '');
              const [score1, score2] = clean.split('/').map((s: string) => parseInt(s.trim()));
              if (!isNaN(score1) && !isNaN(score2)) {
                if (score1 > score2) setsWon++;
                else if (score2 > score1) setsLost++;
              }
            });

            if (setsWon > setsLost) wins++;
            else if (setsLost > setsWon) losses++;
          }
        });

        // Total matches must be the actual count of recorded matches, not
        // wins + losses - a match whose score string doesn't parse into a
        // clear set-by-set winner (unusual format, walkover, etc.) would
        // otherwise silently disappear from the count entirely.
        const totalMatches = matches.length;
        const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

        console.log('Player stats:', { fullName, tournaments, matches: totalMatches, wins, losses, winRate, videos });

        return {
          playerId: player.id,
          playerName: fullName || 'Unknown Player',
          tournaments,
          matches: totalMatches,
          wins,
          losses,
          winRate,
          videos,
        };
      });

      const stats = await Promise.all(statsPromises);
      console.log('All player stats:', stats);
      setPlayerStats(stats);
    } catch (error) {
      console.error('Error loading player stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050d1a]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C8F135]"></div>
      </div>
    );
  }

  const userName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Player';
  const totalPlayers = playerStats.length;
  const totalTournaments = playerStats.reduce((sum, p) => sum + p.tournaments, 0);
  const totalMatches = playerStats.reduce((sum, p) => sum + p.matches, 0);
  const totalVideos = playerStats.reduce((sum, p) => sum + p.videos, 0);
  const hasAnyActivity = totalTournaments > 0 || totalMatches > 0 || totalVideos > 0;

  console.log('Totals:', { totalPlayers, totalTournaments, totalMatches, totalVideos });

  return (
    <div className="min-h-screen bg-[#050d1a]">
      <section className="relative bg-[#070f1c] py-16 lg:py-24 overflow-hidden">
        <CourtBackground opacity={0.4} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050d1a]/88 via-[#071428]/55 to-[#050d1a]/92 z-[1]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
          <div className="mb-12 text-center">
            <div className="flex flex-col items-center">
              <img
                src="/tennis-ball.svg"
                alt="Tennis Ball"
                className="h-10 sm:h-12 lg:h-14 w-auto mb-3 drop-shadow-lg"
              />
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-4">
                Welcome back, <span className="text-[#C8F135]">{userName}</span>
              </h1>
            </div>
            <p className="text-gray-400 text-lg">Your tennis activity dashboard</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-4 max-w-6xl mx-auto">
            <AnimatedStatCard
              value={totalPlayers}
              title="Your Players"
              description="players you are tracking"
              icon={User}
            />
            <AnimatedStatCard
              value={totalTournaments}
              title="Tournaments"
              description="total registered"
              icon={Trophy}
            />
            <AnimatedStatCard
              value={totalMatches}
              title="Match Results"
              description="total match results recorded"
              icon={Calendar}
            />
            <AnimatedStatCard
              value={totalVideos}
              title="Videos"
              description="total videos uploaded"
              icon={Video}
            />
          </div>
        </div>
      </section>

      <section className="relative bg-[#070f1c] py-16 lg:py-24 border-t border-[#1A6FC4]/15 overflow-hidden">
        <CourtLinePattern />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
          {!hasAnyActivity ? (
            <div className="border border-white/8 rounded-2xl bg-white/3 p-12 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">
                Get Started with MyTenniStats
              </h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Start tracking your tennis journey by registering for tournaments, recording match results, or uploading videos.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <button
                  onClick={() => window.location.hash = '#/tournaments'}
                  className="px-6 py-3 bg-[#C8F135] text-[#050d1a] rounded-full font-bold hover:bg-white transition-all duration-300 hover:scale-105"
                >
                  Browse Tournaments
                </button>
                <button
                  onClick={() => window.location.hash = '#/matches'}
                  className="px-6 py-3 border-2 border-[#C8F135] text-[#C8F135] rounded-full font-bold hover:bg-[#C8F135]/10 transition-all duration-300"
                >
                  Record Match
                </button>
                <button
                  onClick={() => window.location.hash = '#/videos'}
                  className="px-6 py-3 border-2 border-[#C8F135] text-[#C8F135] rounded-full font-bold hover:bg-[#C8F135]/10 transition-all duration-300"
                >
                  Upload Video
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mb-12">
                <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight mb-3">
                  Player Statistics
                </h2>
                <p className="text-gray-400 text-lg">Individual performance breakdown</p>
              </div>

              {playerStats.map((player) => (
                <div key={player.playerId} className="border border-white/8 rounded-2xl bg-white/3 overflow-hidden hover:bg-white/5 transition-all duration-400">
                  <div className="bg-gradient-to-r from-[#C8F135] to-[#a8cc2d] px-6 py-4">
                    <div className="flex items-center gap-3">
                      <User className="w-6 h-6 text-[#050d1a]" />
                      <h3 className="text-xl font-bold text-[#050d1a]">{player.playerName}</h3>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <PlayerStatBox
                        value={player.tournaments}
                        title="Tournaments"
                        description="Total registered"
                        icon={Trophy}
                      />

                      <MatchResultsBox
                        matches={player.matches}
                        wins={player.wins}
                        losses={player.losses}
                        winRate={player.winRate}
                      />

                      <PlayerStatBox
                        value={player.videos}
                        title="Videos"
                        description="Total uploaded"
                        icon={Video}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
