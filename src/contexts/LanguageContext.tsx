import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { Play, Star, Download, TrendingUp } from 'lucide-react';
import { CourtLinePattern } from './CourtBackground';
import { useLanguage } from '../../contexts/LanguageContext';

const SHOTS = [
  { label: 'forehand', faults: 3, winners: 7 },
  { label: 'backhand', faults: 6, winners: 2 },
  { label: 'service', faults: 2, winners: 5 },
  { label: 'volley', faults: 1, winners: 4 },
];

function LiveScoreMockup({ windowLabel }: { windowLabel: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
        <span className="ml-3 text-xs text-gray-500 font-medium">{windowLabel}</span>
      </div>
      <div className="p-4 sm:p-6 space-y-1.5">
        {SHOTS.map((shot) => {
          const total = shot.faults + shot.winners;
          const winnerPct = Math.round((shot.winners / total) * 100);
          return (
            <div key={shot.label} className="flex items-center gap-2 p-1.5 rounded-lg border border-white/10 bg-white/5">
              <span className="w-16 text-xs font-medium text-gray-300 capitalize shrink-0">{shot.label}</span>
              <span className="flex-1 px-2 py-1.5 bg-red-500/90 text-white text-[11px] rounded font-medium text-center">
                Faute
              </span>
              <span className="flex-1 px-2 py-1.5 bg-green-500/90 text-white text-[11px] rounded font-medium text-center">
                Gagne
              </span>
              <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden shrink-0 hidden sm:block">
                <div className="h-full bg-[#C8F135]" style={{ width: `${winnerPct}%` }} />
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 pt-2 text-[11px] text-gray-500">
          <TrendingUp size={12} className="text-[#C8F135]" />
          <span>{SHOTS.reduce((s, x) => s + x.winners, 0)} winners · {SHOTS.reduce((s, x) => s + x.faults, 0)} faults this match</span>
        </div>
      </div>
    </div>
  );
}

function VideoLibraryMockup({ windowLabel }: { windowLabel: string }) {
  const clips = [
    { tag: 'Forehand', when: 'Practice — Jan' },
    { tag: 'Forehand', when: 'Match — Jun' },
    { tag: 'Backhand', when: 'Practice — Mar' },
  ];

  return (
    <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
        <span className="ml-3 text-xs text-gray-500 font-medium">{windowLabel}</span>
      </div>
      <div className="p-4 sm:p-6">
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#0f1e35]/80 to-[#0a1628]/80 overflow-hidden mb-3">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-xs font-semibold text-white">Lecture</span>
            <div className="flex items-center gap-1.5 text-gray-500">
              <Star size={13} className="text-[#C8F135] fill-current" />
              <Download size={13} />
            </div>
          </div>
          <div className="aspect-video bg-black/40 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-[#C8F135]/90 flex items-center justify-center">
              <Play size={16} className="text-[#050d1a] ml-0.5" fill="currentColor" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {clips.map((c, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="aspect-video rounded bg-black/50 mb-1.5 flex items-center justify-center">
                <Play size={12} className="text-white/70" />
              </div>
              <p className="text-[10px] font-semibold text-gray-300 truncate">{c.tag}</p>
              <p className="text-[9px] text-gray-500 truncate">{c.when}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingHowItWorks() {
  const { ref, isVisible } = useScrollAnimation();
  const { t } = useLanguage();

  return (
    <section id="how-it-works" className="relative bg-[#050d1a] py-24 lg:py-32 border-t border-[#1A6FC4]/15 overflow-hidden">
      <CourtLinePattern />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
        <div
          ref={ref}
          className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="mb-16 max-w-2xl">
            <p className="text-[#C8F135] text-sm font-medium tracking-widest uppercase mb-3">{t.howItWorks.badge}</p>
            <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-6">
              {t.howItWorks.title}
            </h2>
            <p className="text-gray-400 leading-relaxed">
              {t.howItWorks.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-20">
            <div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white tracking-tight mb-4">
                {t.howItWorks.liveScore.title}
              </h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                {t.howItWorks.liveScore.description}
              </p>
              <ul className="space-y-2.5">
                {t.howItWorks.liveScore.bullets.map((b: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#C8F135] shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <LiveScoreMockup windowLabel={t.howItWorks.liveScore.windowLabel} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="lg:order-2">
              <h3 className="text-2xl lg:text-3xl font-bold text-white tracking-tight mb-4">
                {t.howItWorks.video.title}
              </h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                {t.howItWorks.video.description}
              </p>
              <ul className="space-y-2.5">
                {t.howItWorks.video.bullets.map((b: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#C8F135] shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:order-1">
              <VideoLibraryMockup windowLabel={t.howItWorks.video.windowLabel} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}