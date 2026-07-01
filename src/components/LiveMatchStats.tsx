import { useState, useMemo } from 'react';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type LiveMatchStatsProps = {
  scoringHistory: any[];
};

export function LiveMatchStats({ scoringHistory }: LiveMatchStatsProps) {
  const [dataType, setDataType] = useState<'win' | 'loss'>('win');

  const stats = useMemo(() => {
    const skillStats: any = {};
    const skills = ['forehand', 'backhand', 'serve', 'return', 'volley', 'opponent'];

    skills.forEach(skill => {
      const skillEntries = scoringHistory.filter(entry => {
        if (entry.toggleValue) {
          const parts = entry.toggleValue.split(':').map((p: string) => p.trim().toLowerCase());
          if (parts.length === 2) {
            const entrySkill = parts[0];
            if (entrySkill.includes('forehand') || entrySkill.includes('coup droit') || entrySkill === 'cd') return skill === 'forehand';
            if (entrySkill.includes('backhand') || entrySkill.includes('revers') || entrySkill === 'r') return skill === 'backhand';
            if (entrySkill.includes('service') || entrySkill.includes('serve') || entrySkill === 's') return skill === 'serve';
            if (entrySkill.includes('return') || entrySkill.includes('retour') || entrySkill === 'ret') return skill === 'return';
            if (entrySkill.includes('volley') || entrySkill.includes('vollée') || entrySkill === 'v') return skill === 'volley';
            if (entrySkill.includes('opponent') || entrySkill.includes('adversaire') || entrySkill === 'opp') return skill === 'opponent';
            if (entrySkill === skill) return true;
          }
        }
        return false;
      });

      const skillWinners = skillEntries.filter(entry => {
        const parts = entry.toggleValue.split(':').map((p: string) => p.trim().toLowerCase());
        if (parts.length === 2) {
          return parts[1] === 'gagne' || parts[1] === 'winner';
        }
        return false;
      }).length;

      const skillFaults = skillEntries.filter(entry => {
        const parts = entry.toggleValue.split(':').map((p: string) => p.trim().toLowerCase());
        if (parts.length === 2) {
          return parts[1] === 'faute' || parts[1] === 'fault';
        }
        return false;
      }).length;

      const skillTotal = skillWinners + skillFaults;
      const winPercentage = skillTotal > 0 ? Math.round((skillWinners / skillTotal) * 100) : 0;
      const lossPercentage = skillTotal > 0 ? Math.round((skillFaults / skillTotal) * 100) : 0;

      skillStats[skill] = {
        winners: skillWinners,
        faults: skillFaults,
        total: skillTotal,
        winPercentage,
        lossPercentage,
      };
    });

    return skillStats;
  }, [scoringHistory]);

  const radarData = useMemo(() => {
    const labels = ['Forehand', 'Backhand', 'Service', 'Volley', 'Return', 'Opponent'];
    const data = dataType === 'win'
      ? [
          stats.forehand?.winPercentage || 0,
          stats.backhand?.winPercentage || 0,
          stats.serve?.winPercentage || 0,
          stats.volley?.winPercentage || 0,
          stats.return?.winPercentage || 0,
          stats.opponent?.winPercentage || 0,
        ]
      : [
          stats.forehand?.lossPercentage || 0,
          stats.backhand?.lossPercentage || 0,
          stats.serve?.lossPercentage || 0,
          stats.volley?.lossPercentage || 0,
          stats.return?.lossPercentage || 0,
          stats.opponent?.lossPercentage || 0,
        ];

    return {
      labels,
      datasets: [
        {
          label: dataType === 'win' ? 'Win %' : 'Loss %',
          data,
          backgroundColor: dataType === 'win' ? 'rgba(200, 241, 53, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          borderColor: dataType === 'win' ? 'rgba(200, 241, 53, 1)' : 'rgba(239, 68, 68, 1)',
          borderWidth: 2,
          pointBackgroundColor: dataType === 'win' ? 'rgba(200, 241, 53, 1)' : 'rgba(239, 68, 68, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: dataType === 'win' ? 'rgba(200, 241, 53, 1)' : 'rgba(239, 68, 68, 1)',
        },
      ],
    };
  }, [dataType, stats]);

  const radarOptions = {
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
          font: { size: 10 },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        pointLabels: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: { size: 11, weight: '600' as const },
        },
        angleLines: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(5, 13, 26, 0.9)',
        titleColor: dataType === 'win' ? '#C8F135' : '#EF4444',
        bodyColor: '#fff',
        borderColor: dataType === 'win' ? 'rgba(200, 241, 53, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context: any) => `${context.parsed.r}% ${dataType === 'win' ? 'Win' : 'Loss'} Rate`,
        },
      },
    },
  };

  return (
    <div className="p-6 rounded-xl border border-white/8 bg-white/2">
      <div className="flex justify-center gap-2 mb-4">
        <button
          onClick={() => setDataType('win')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            dataType === 'win'
              ? 'bg-[#C8F135] text-black'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          Win
        </button>
        <button
          onClick={() => setDataType('loss')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            dataType === 'loss'
              ? 'bg-red-500 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          Loss
        </button>
      </div>
      <div className="w-full h-64 flex items-center justify-center">
        <Radar data={radarData} options={radarOptions} />
      </div>
    </div>
  );
}
