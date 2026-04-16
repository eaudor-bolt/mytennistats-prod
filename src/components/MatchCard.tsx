import { Calendar, Trophy, Clock } from 'lucide-react';

type MatchCardProps = {
  player1Name: string;
  player2Name: string;
  player1Score: string;
  player2Score: string;
  winnerName: string | null;
  tournamentName: string;
  round: string;
  matchDate: string;
  status: 'scheduled' | 'in_progress' | 'completed';
};

export function MatchCard({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  winnerName,
  tournamentName,
  round,
  matchDate,
  status,
}: MatchCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="flex items-center space-x-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
            <Clock className="w-3 h-3" />
            <span>Live</span>
          </span>
        );
      case 'scheduled':
        return (
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
            Scheduled
          </span>
        );
      case 'completed':
        return (
          <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-semibold">
            Completed
          </span>
        );
    }
  };

  const isPlayer1Winner = winnerName === player1Name;
  const isPlayer2Winner = winnerName === player2Name;

  const formatScore = (score1: string, score2: string) => {
    if (!score1 || score1 === '-') return '-';

    const sets1 = score1.split(' ').filter(s => s);
    const sets2 = score2.split(' ').filter(s => s);

    if (sets1.length !== sets2.length) return score1;

    return sets1.map((s1, idx) => `${s1}-${sets2[idx]}`).join(', ');
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
      <div className="bg-gradient-to-r from-green-500 to-green-600 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <p className="text-sm font-medium opacity-90">{tournamentName}</p>
            <p className="text-xs opacity-75">{round}</p>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      <div className="p-5">
        <div className="space-y-3">
          <div className={`grid grid-cols-[1fr,auto] gap-4 p-3 rounded-lg transition-colors ${
            isPlayer1Winner ? 'bg-green-50 border-2 border-green-500' : 'bg-gray-50'
          }`}>
            <div className="flex items-center space-x-3">
              {isPlayer1Winner && <Trophy className="w-5 h-5 text-green-600" />}
              <span className={`font-semibold ${isPlayer1Winner ? 'text-green-900' : 'text-gray-900'}`}>
                {player1Name}
              </span>
            </div>
            <span className={`text-xl font-bold ${isPlayer1Winner ? 'text-green-600' : 'text-gray-700'}`}>
              {formatScore(player1Score, player2Score)}
            </span>
          </div>

          <div className={`grid grid-cols-[1fr,auto] gap-4 p-3 rounded-lg transition-colors ${
            isPlayer2Winner ? 'bg-green-50 border-2 border-green-500' : 'bg-gray-50'
          }`}>
            <div className="flex items-center space-x-3">
              {isPlayer2Winner && <Trophy className="w-5 h-5 text-green-600" />}
              <span className={`font-semibold ${isPlayer2Winner ? 'text-green-900' : 'text-gray-900'}`}>
                {player2Name}
              </span>
            </div>
            <span className={`text-xl font-bold ${isPlayer2Winner ? 'text-green-600' : 'text-gray-700'}`}>
              {formatScore(player2Score, player1Score)}
            </span>
          </div>
        </div>

        <div className="flex items-center text-gray-600 text-sm mt-4 pt-4 border-t border-gray-100">
          <Calendar className="w-4 h-4 mr-2" />
          <span>{formatDate(matchDate)}</span>
        </div>
      </div>
    </div>
  );
}
