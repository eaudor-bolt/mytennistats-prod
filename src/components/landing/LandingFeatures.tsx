import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { Calendar, Radio, Brain, Video, BookOpen } from 'lucide-react';
import { CourtLinePattern } from './CourtBackground';
import { useLanguage } from '../../contexts/LanguageContext';

const icons = [Calendar, Radio, Brain, Video, BookOpen];

export function LandingFeatures() {
  const { ref, isVisible } = useScrollAnimation();
  const { t } = useLanguage();
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
