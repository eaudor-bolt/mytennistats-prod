import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { TrendingUp, Radar, Share2, Video } from 'lucide-react';
import { CourtLinePattern } from './CourtBackground';
import { useLanguage } from '../../contexts/LanguageContext';

const icons = [TrendingUp, Radar, Share2, Video];

export function LandingForPlayers() {
  const { ref, isVisible } = useScrollAnimation();
  const { t } = useLanguage();

  return (
    <section id="players" className="relative bg-[#060e1b] py-24 lg:py-32 border-t border-[#1A6FC4]/15 overflow-hidden">
      <CourtLinePattern />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
        <div
          ref={ref}
          className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[#C8F135] text-sm font-medium tracking-widest uppercase mb-3">{t.forPlayers.badge}</p>
              <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-6">
                {t.forPlayers.title}
              </h2>
              <p className="text-gray-400 leading-relaxed max-w-lg">
                {t.forPlayers.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {t.forPlayers.benefits.map((b: any, i: number) => {
                const Icon = icons[i];
                return (
                  <div
                    key={i}
                    className="p-5 rounded-2xl border border-white/8 bg-white/2 hover:border-[#C8F135]/25 hover:bg-white/4 transition-all duration-300"
                    style={{ transitionDelay: `${i * 60}ms` }}
                  >
                    <div className="mb-3 w-9 h-9 rounded-lg bg-[#C8F135]/10 flex items-center justify-center">
                      <Icon size={17} className="text-[#C8F135]" />
                    </div>
                    <h4 className="text-white font-semibold text-sm mb-2">{b.title}</h4>
                    <p className="text-gray-500 text-xs leading-relaxed">{b.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
