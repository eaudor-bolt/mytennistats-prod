import { useState, useMemo } from 'react';
import { BarChart2, Radar as RadarIcon } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Bar, Radar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type LiveMatchStatsProps = {
  scoringHistory: any[];
};

export function LiveMatchStats({ scoringHistory }: LiveMatchStatsProps) {
  const [chartType, setChartType] = useState<'bar' | 'radar'>('bar');
  const [dataType, setDataType] = useState<'win' | 'loss'>('loss');

  const stats = useMemo(() => {
    const skillStats: any = {};
    const skills = ['forehand', 'backhand', 'serve', 'return'];

    skills.forEach(skill => {
      const skillEntries = scoringHistory.filter(entry => {
        if (entry.toggleValue) {
          const [entrySkill] = entry.toggleValue.split(': ');
          return entrySkill === skill;
        }
        return false;
      });

      const skillWinners = skillEntries.filter(entry => {
        const [, action] = entry.toggleValue.split(': ');
        return action === 'Gagne';
      }).length;

      const skillFaults = skillEntries.filter(entry => {
        const [, action] = entry.toggleValue.split(': ');
        return action === 'Faute';
      }).length;

      const skillTotal = skillEntries.length;
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

  const chartData = useMemo(() => {
    const labels = ['Coup Droit', 'Revers', 'Service', 'Retour'];
    const data = dataType === 'win'
      ? [
          stats.forehand?.winPercentage || 0,
          stats.backhand?.winPercentage || 0,
          stats.serve?.winPercentage || 0,
          stats.return?.winPercentage || 0,
        ]
      : [
          stats.forehand?.lossPercentage || 0,
          stats.backhand?.lossPercentage || 0,
          stats.serve?.lossPercentage || 0,
          stats.return?.lossPercentage || 0,
        ];

    if (chartType === 'bar') {
      return {
        labels,
        datasets: [
          {
            label: dataType === 'win' ? 'Winners %' : 'Fautes %',
            data,
            backgroundColor: dataType === 'win' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)',
            borderColor: dataType === 'win' ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)',
            borderWidth: 1,
          },
        ],
      };
    } else {
      return {
        labels,
        datasets: [
          {
            label: dataType === 'win' ? 'Winners %' : 'Fautes %',
            data,
            backgroundColor: dataType === 'win' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            borderColor: dataType === 'win' ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)',
            borderWidth: 2,
            pointBackgroundColor: dataType === 'win' ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: dataType === 'win' ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)',
          },
        ],
      };
    }
  }, [chartType, dataType, stats]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            const skill = ['forehand', 'backhand', 'serve', 'return'][context.dataIndex];
            const skillData = stats[skill];
            if (dataType === 'win') {
              return [
                `Winners: ${skillData?.winners || 0}`,
                `Total: ${skillData?.total || 0}`,
                `Pourcentage: ${context.parsed.y}%`,
              ];
            } else {
              return [
                `Fautes: ${skillData?.faults || 0}`,
                `Total: ${skillData?.total || 0}`,
                `Pourcentage: ${context.parsed.y}%`,
              ];
            }
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function (value: any) {
            return value + '%';
          },
        },
      },
    },
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            const skill = ['forehand', 'backhand', 'serve', 'return'][context.dataIndex];
            const skillData = stats[skill];
            if (dataType === 'win') {
              return [
                `Winners: ${skillData?.winners || 0}`,
                `Total: ${skillData?.total || 0}`,
                `Pourcentage: ${context.parsed.r}%`,
              ];
            } else {
              return [
                `Fautes: ${skillData?.faults || 0}`,
                `Total: ${skillData?.total || 0}`,
                `Pourcentage: ${context.parsed.r}%`,
              ];
            }
          },
        },
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20,
          callback: function (value: any) {
            return value + '%';
          },
          color: '#9ca3af',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        angleLines: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        pointLabels: {
          color: '#e5e7eb',
          font: {
            size: 12,
          },
        },
      },
    },
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/10">
      <h4 className="text-lg font-semibold text-white mb-4">
        Pourcentage de Winners par Compétence
      </h4>

      <div className="flex flex-col items-center gap-2 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              chartType === 'bar'
                ? 'bg-[#C8F135] text-black'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            %
          </button>
          <button
            onClick={() => setChartType('radar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              chartType === 'radar'
                ? 'bg-[#C8F135] text-black'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <RadarIcon className="w-4 h-4" />
            Radar
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setDataType('win')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              dataType === 'win'
                ? 'bg-green-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            Win
          </button>
          <button
            onClick={() => setDataType('loss')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              dataType === 'loss'
                ? 'bg-red-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            Loss
          </button>
        </div>
      </div>

      <div className="flex justify-center items-center p-4">
        <div className="w-full max-w-md">
          {chartType === 'bar' ? (
            <Bar data={chartData} options={barOptions} />
          ) : (
            <Radar data={chartData} options={radarOptions} />
          )}
        </div>
      </div>
    </div>
  );
}
