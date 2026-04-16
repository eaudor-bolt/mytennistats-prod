import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function LandingHeader({ onLoginClick, onSignupClick }: { onLoginClick: () => void; onSignupClick: () => void }) {
  const { language, setLanguage, t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: t.nav.home, href: '#home' },
    { label: t.nav.framework, href: '#framework' },
    { label: t.nav.players, href: '#players' },
    { label: t.nav.coaches, href: '#coaches' },
    { label: t.nav.pricing, href: '#pricing' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#040c1a]/95 backdrop-blur-md shadow-lg shadow-black/40 border-b border-[#1A6FC4]/10'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between h-16 lg:h-20">
        <a href="#home" className="flex items-center gap-2 group shrink-0">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rounded-full bg-[#C8F135] group-hover:scale-110 transition-transform duration-300" />
            <div className="absolute inset-[2px] rounded-full border-2 border-[#040c1a]/40" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-px h-full bg-[#040c1a]/30 rotate-45" />
            </div>
          </div>
          <span className="text-white font-bold text-base tracking-tight">
            myTenni<span className="text-[#C8F135]">Stats</span>
          </span>
        </a>

        <div className="hidden lg:flex items-center gap-6">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-gray-400 hover:text-white transition-colors duration-200 tracking-wide whitespace-nowrap"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <div className="flex items-center border border-white/10 rounded-full overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1.5 transition-colors duration-200 ${
                language === 'en' ? 'bg-[#C8F135] text-[#050d1a]' : 'text-gray-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('fr')}
              className={`px-3 py-1.5 transition-colors duration-200 ${
                language === 'fr' ? 'bg-[#C8F135] text-[#050d1a]' : 'text-gray-400 hover:text-white'
              }`}
            >
              FR
            </button>
          </div>

          <button
            onClick={onLoginClick}
            className="text-sm text-gray-400 hover:text-white transition-colors duration-200 px-3 py-1.5"
          >
            {t.nav.login}
          </button>
          <button
            onClick={onSignupClick}
            className="text-sm bg-[#C8F135] text-[#050d1a] font-bold px-4 py-1.5 rounded-full hover:bg-white transition-all duration-200"
          >
            {t.nav.signup}
          </button>
        </div>

        <button
          className="lg:hidden text-white p-2"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-[#040c1a]/98 backdrop-blur-md border-t border-[#1A6FC4]/15 px-6 py-5 flex flex-col gap-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors duration-200 py-1"
            >
              {link.label}
            </a>
          ))}

          <div className="pt-3 border-t border-white/8 flex items-center justify-between">
            <div className="flex items-center border border-white/10 rounded-full overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 transition-colors duration-200 ${language === 'en' ? 'bg-[#C8F135] text-[#050d1a]' : 'text-gray-400'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('fr')}
                className={`px-3 py-1.5 transition-colors duration-200 ${language === 'fr' ? 'bg-[#C8F135] text-[#050d1a]' : 'text-gray-400'}`}
              >
                FR
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { onLoginClick(); setOpen(false); }}
                className="text-sm text-gray-300 px-3 py-1.5 border border-white/15 rounded-full hover:text-white transition-colors"
              >
                {t.nav.login}
              </button>
              <button
                onClick={() => { onSignupClick(); setOpen(false); }}
                className="text-sm bg-[#C8F135] text-[#050d1a] font-bold px-3 py-1.5 rounded-full hover:bg-white transition-colors"
              >
                {t.nav.signup}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
