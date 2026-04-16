import { ChevronDown, Activity } from 'lucide-react';
import CourtBackground from './CourtBackground';
import { useLanguage } from '../../contexts/LanguageContext';

interface LandingHeroProps {
  onSignUp: () => void;
}

export function LandingHero({ onSignUp }: LandingHeroProps) {
  const { t } = useLanguage();

  return (
    <section id="home" className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-[#050d1a]">
      <CourtBackground />

      <div className="absolute inset-0 bg-gradient-to-b from-[#050d1a]/88 via-[#071428]/55 to-[#050d1a]/92 z-[1]" />

      <div className="absolute inset-0 z-[1] pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-[#1A6FC4]/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-28 pb-20">
        <div className="flex items-center gap-2 mb-6">
          <Activity size={16} className="text-[#C8F135]" />
          <span className="text-[#C8F135] text-sm font-medium tracking-widest uppercase">
            {t.hero.badge}
          </span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-8xl font-black text-white leading-[1.0] tracking-tight mb-6 max-w-5xl">
          {t.hero.title1}<br />
          <span className="text-[#C8F135]">{t.hero.title2}</span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mb-10 leading-relaxed">
          {t.hero.description}
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            onClick={onSignUp}
            className="group inline-flex items-center gap-2 bg-[#C8F135] text-[#050d1a] font-bold px-7 py-3.5 rounded-full text-sm hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/25"
          >
            {t.hero.cta}
            <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
          </button>
        </div>
      </div>

      <a
        href="#framework"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 hover:text-[#C8F135] transition-colors duration-200 animate-bounce z-10"
      >
        <ChevronDown size={24} />
      </a>
    </section>
  );
}
