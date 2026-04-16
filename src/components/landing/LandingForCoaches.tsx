import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { Users, FileText, Zap, Globe } from 'lucide-react';
import { CourtLinePattern } from './CourtBackground';
import { useLanguage } from '../../contexts/LanguageContext';

const icons = [Users, FileText, Zap, Globe];

export function LandingForCoaches() {
  const { ref, isVisible } = useScrollAnimation();
  const { t } = useLanguage();

  return (
    <section id="coaches" className="relative bg-[#070f1c] py-24 lg:py-32 border-t border-[#1A6FC4]/15 overflow-hidden">
      <CourtLinePattern />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#1A6FC4]/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
        <div
          ref={ref}
          className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-[#C8F135] text-sm font-medium tracking-widest uppercase mb-3">{t.forCoaches.badge}</p>
            <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-4">
              {t.forCoaches.title}
            </h2>
            <p className="text-gray-500 leading-relaxed">
              {t.forCoaches.description}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.forCoaches.tools.map((tool: any, i: number) => {
              const Icon = icons[i];
              return (
                <div
                  key={i}
                  className="group flex flex-col gap-4 p-6 rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center group-hover:bg-[#C8F135]/20 transition-colors duration-300">
                    <Icon size={18} className="text-[#C8F135]" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">{tool.title}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">{tool.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
