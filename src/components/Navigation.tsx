import { useState } from 'react';
import { Trophy, Calendar, Settings, BookOpen, MapPin, Video, Menu, X, Home } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { trackNavigation } from '../utils/analytics';

type NavigationProps = {
  currentPage: string;
  onNavigate: (page: string) => void;
};

export function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
//    { id: 'home', label: 'Home', icon: Home },
    { id: 'tournaments', label: t('nav.tournaments'), icon: Trophy },
    { id: 'matches', label: t('nav.matches'), icon: Calendar },
    { id: 'clubs', label: 'Clubs', icon: MapPin },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'rules', label: t('nav.rules'), icon: BookOpen },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  const handleNavigate = (id: string) => {
    trackNavigation(id, currentPage);
    window.location.hash = `#/${id}`;
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const activeItem = navItems.find((item) => item.id === currentPage);

  return (
    <>
      <nav className="bg-[#040c1a]/95 backdrop-blur-md shadow-lg shadow-black/40 border-b border-[#1A6FC4]/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-white/5 transition"
                aria-label="Menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5 text-white" />
                ) : (
                  <Menu className="w-5 h-5 text-white" />
                )}
              </button>
              <button
                onClick={() => handleNavigate('home')}
                className="flex items-center gap-2 group shrink-0"
              >
                <div className="relative w-7 h-7">
                  <div className="absolute inset-0 rounded-full bg-[#C8F135] group-hover:scale-110 transition-transform duration-300" />
                  <div className="absolute inset-[2px] rounded-full border-2 border-[#040c1a]/40" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-px h-full bg-[#040c1a]/30 rotate-45" />
                  </div>
                </div>
                <h1 className="text-base sm:text-xl font-bold text-white tracking-tight">
                  myTenni<span className="text-[#C8F135]">Stats</span>
                </h1>
              </button>
            </div>

            <div className="hidden lg:flex items-center gap-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 text-sm ${
                      isActive
                        ? 'bg-[#C8F135] text-[#040c1a] font-bold'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {activeItem && (
              <div className="lg:hidden flex items-center gap-2 text-sm font-medium text-gray-400">
                <activeItem.icon className="w-4 h-4 text-[#C8F135]" />
                {activeItem.label}
              </div>
            )}
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute top-16 lg:top-20 left-0 right-0 bg-[#060e1b] border-b border-[#1A6FC4]/20 shadow-xl">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-[#C8F135] text-[#040c1a] font-bold'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${isActive ? 'text-[#040c1a]' : 'text-gray-400'}`}
                    />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
