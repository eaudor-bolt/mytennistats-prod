import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { Calendar, Radio, Brain, Video, BookOpen, Clock } from 'lucide-react';
import { CourtLinePattern } from './CourtBackground';
import { useLanguage } from '../../contexts/LanguageContext';

const icons = [Calendar, Radio, Brain, Video, BookOpen];

export function LandingFeatures() {
  const { ref, isVisible } = useScrollAnimation();
  const { t, language } = useLanguage();
  const features = t.features.items.map((item: any, i: number) => ({ ...item, icon: icons[i] }));

  return (
    <section id="framework" className="relative bg-[#070f1c] py-24 lg:py-32 border-t border-[#1A6FC4]/15 overflow-hidden">
      <CourtLinePattern />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
        <div
          ref={ref}
          className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="mb-16">
            <p className="text-[#C8F135] text-sm font-medium tracking-widest uppercase mb-3">{t.features.badge}</p>
            <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-6">
              {t.features.title}
            </h2>
            <p className="text-gray-400 max-w-2xl leading-relaxed">
              {t.features.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f: any, i: number) => (
              <div
                key={i}
                className={`group relative p-8 rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-500 ${i === 4 ? 'md:col-span-2 lg:col-span-1' : ''}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="absolute top-6 right-6">
                  <span className="text-xs text-[#C8F135]/60 font-medium tracking-wider uppercase border border-[#C8F135]/20 rounded-full px-3 py-1">
                    {f.tag}
                  </span>
                </div>
                <div className="mb-5 w-11 h-11 rounded-xl bg-[#C8F135]/10 flex items-center justify-center group-hover:bg-[#C8F135]/20 transition-colors duration-300">
                  <f.icon size={20} className="text-[#C8F135]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                {i === 0 && (
                  <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Clock size={14} className="text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400">Coming Soon</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Screenshots showcase */}
          <div className="mt-20">
            <h3 className="text-2xl lg:text-3xl font-black text-white tracking-tight mb-3 text-center">
              {language === 'fr' ? 'Aperçu de l\'application' : 'App Preview'}
            </h3>
            <p className="text-gray-400 text-center mb-10 max-w-xl mx-auto">
              {language === 'fr'
                ? 'Score en direct, statistiques de match et graphique radar pour analyser vos performances.'
                : 'Live scoring, match statistics, and radar chart to analyze your performance.'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Live Scoreboard Screenshot */}
              <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  <span className="ml-3 text-xs text-gray-500 font-medium">Live Score</span>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="bg-gradient-to-br from-[#0f1e35]/80 to-[#0a1628]/80 rounded-xl p-3 sm:p-4 border border-white/5">
                    <table className="w-full bg-white/5 rounded-lg overflow-hidden border border-white/10">
                      <tbody>
                        <tr className="border-b border-white/10">
                          <td className="px-3 py-2 text-sm font-semibold text-gray-200 bg-white/5">
                            <div className="flex items-center justify-between">
                              <span>Adversaire</span>
                              <span className="w-10 h-6 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded">30</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center text-sm font-bold text-gray-300">6<sup className="text-[10px]">5</sup></td>
                          <td className="px-3 py-2 text-center text-sm font-bold text-gray-300">3</td>
                          <td className="px-3 py-2 text-center text-sm font-bold bg-[#C8F135]/20 text-[#C8F135]">2</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-200 bg-white/5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span>Player</span>
                                <img src="/tennis-ball.svg" alt="" className="w-2.5 h-2.5" />
                              </div>
                              <span className="w-10 h-6 flex items-center justify-center bg-green-500 text-white text-xs font-bold rounded">40</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center text-sm font-bold text-gray-300">7<sup className="text-[10px]">7</sup></td>
                          <td className="px-3 py-2 text-center text-sm font-bold text-gray-300">6</td>
                          <td className="px-3 py-2 text-center text-sm font-bold bg-[#C8F135]/20 text-[#C8F135]">3</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Match Stats Radar Screenshot */}
              <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  <span className="ml-3 text-xs text-gray-500 font-medium">{language === 'fr' ? 'Statistiques du Match' : 'Match Statistics'}</span>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="flex justify-center">
                    <svg viewBox="0 0 300 280" className="w-full max-w-[280px]">
                      {/* Radar grid */}
                      <g transform="translate(150, 140)">
                        {/* Grid rings */}
                        {[100, 80, 60, 40, 20].map((r) => (
                          <polygon
                            key={r}
                            points={[0, 1, 2, 3, 4].map((i) => {
                              const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                              return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
                            }).join(' ')}
                            fill="none"
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="1"
                          />
                        ))}
                        {/* Axis lines */}
                        {[0, 1, 2, 3, 4].map((i) => {
                          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                          return (
                            <line
                              key={i}
                              x1="0"
                              y1="0"
                              x2={Math.cos(angle) * 100}
                              y2={Math.sin(angle) * 100}
                              stroke="rgba(255,255,255,0.08)"
                              strokeWidth="1"
                            />
                          );
                        })}
                        {/* Data shape */}
                        <polygon
                          points={[85, 60, 70, 45, 90].map((val, i) => {
                            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                            return `${Math.cos(angle) * val},${Math.sin(angle) * val}`;
                          }).join(' ')}
                          fill="rgba(200, 241, 53, 0.15)"
                          stroke="rgba(200, 241, 53, 0.9)"
                          strokeWidth="2"
                        />
                        {/* Data points */}
                        {[85, 60, 70, 45, 90].map((val, i) => {
                          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                          return (
                            <circle
                              key={i}
                              cx={Math.cos(angle) * val}
                              cy={Math.sin(angle) * val}
                              r="4"
                              fill="#C8F135"
                              stroke="#fff"
                              strokeWidth="1.5"
                            />
                          );
                        })}
                      </g>
                      {/* Labels */}
                      <text x="150" y="22" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="11" fontWeight="600">Forehand</text>
                      <text x="253" y="115" textAnchor="start" fill="rgba(255,255,255,0.7)" fontSize="11" fontWeight="600">Backhand</text>
                      <text x="220" y="245" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="11" fontWeight="600">Service</text>
                      <text x="80" y="245" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="11" fontWeight="600">Return</text>
                      <text x="47" y="115" textAnchor="end" fill="rgba(255,255,255,0.7)" fontSize="11" fontWeight="600">Volley</text>
                    </svg>
                  </div>
                  <div className="flex justify-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[#C8F135]" />
                      <span className="text-xs text-gray-400">Win %</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-red-500" />
                      <span className="text-xs text-gray-400">Loss %</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
