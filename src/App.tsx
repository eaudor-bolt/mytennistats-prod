import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Navigation } from './components/Navigation';
import { HomePage } from './pages/HomePage';
import { TournamentsPage } from './pages/TournamentsPage';
import { MatchesPage } from './pages/MatchesPage';
import { ClubsPage } from './pages/ClubsPage';
import { VideosPage } from './pages/VideosPage';
import { RulesPage } from './pages/RulesPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { LiveMatchPage } from './pages/LiveMatchPage';
import { MatchHistoryPage } from './pages/MatchHistoryPage';
import { SharedMatchResultsPage } from './pages/SharedMatchResultsPage';
import VideoEditorPage from './pages/VideoEditorPage';
import { PlayersProvider } from './contexts/PlayersContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { TournamentDataProvider } from './contexts/TournamentDataContext';
import { Loader2 } from 'lucide-react';
import { trackPageView, trackUserAction } from './utils/analytics';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);
  const [matchHistoryId, setMatchHistoryId] = useState<string | null>(null);
  const [sharedResultsId, setSharedResultsId] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginMode, setLoginMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    const checkAndClearBadSession = async () => {
      try {
        const { error } = await supabase.auth.getSession();
        if (error) {
          console.error('Invalid session detected, clearing storage:', error);
          await supabase.auth.signOut();
          window.localStorage.removeItem('tennis-auth');
        }
      } catch (error) {
        console.error('Session check error:', error);
        window.localStorage.removeItem('tennis-auth');
      }
    };

    checkAndClearBadSession();

    const handleRouting = () => {
      const hash = window.location.hash.slice(1);
      const pathname = window.location.pathname;
      const path = hash || pathname;
      const searchParams = new URLSearchParams(window.location.search || hash.split('?')[1]);
      const pageParam = searchParams.get('page');

      const liveMatch = path.match(/^\/live\/([a-f0-9-]+)$/);
      const matchHistory = path.match(/^\/match-history\/([a-f0-9-]+)$/);
      const sharedResults = path.match(/^\/shared-results\/([a-f0-9-]+)$/);

      if (liveMatch) {
        setLiveMatchId(liveMatch[1]);
        setLoading(false);
        return;
      }

      if (matchHistory) {
        setMatchHistoryId(matchHistory[1]);
        setLoading(false);
        return;
      }

      if (sharedResults) {
        setSharedResultsId(sharedResults[1]);
        setLoading(false);
        return;
      }

      const authenticatedPages = [
        'home',
        'tournaments',
        'matches',
        'clubs',
        'videos',
        'video-editor',
        'rules',
        'settings'
      ];

      const cleanPath = path.startsWith('/') ? path.slice(1) : path;

      if (authenticatedPages.includes(cleanPath)) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          if (session) {
            setCurrentPage(cleanPath);
          }
          setLoading(false);
        }).catch((error) => {
          console.error('Auth error:', error);
          setSession(null);
          setLoading(false);
        });
        return;
      }

      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (pageParam && session) {
          setCurrentPage(pageParam);
        }
        setLoading(false);
      }).catch((error) => {
        console.error('Auth error:', error);
        setSession(null);
        setLoading(false);
      });
    };

    handleRouting();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (event === 'SIGNED_IN') {
        trackUserAction('login');
      } else if (event === 'SIGNED_OUT') {
        trackUserAction('logout');
      } else if (event === 'USER_UPDATED') {
        trackUserAction('profile_update');
      }
    });

    window.addEventListener('hashchange', handleRouting);

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener('hashchange', handleRouting);
    };
  }, []);

  useEffect(() => {
    if (currentPage) {
      const pageNameMap: Record<string, string> = {
        home: 'HomePage',
        tournaments: 'TournamentPage',
        matches: 'MatchPage',
        clubs: 'ClubPage',
        videos: 'VideoPage',
        'video-editor': 'VideoPage',
        rules: 'RulePage',
        settings: 'Settings',
      };
      const pageName = pageNameMap[currentPage] || currentPage;
      trackPageView(`/${currentPage}`, pageName);
    }
  }, [currentPage]);

  useEffect(() => {
    if (liveMatchId) {
      trackPageView(`/live/${liveMatchId}`, 'LiveScore');
    }
  }, [liveMatchId]);

  useEffect(() => {
    if (matchHistoryId) {
      trackPageView(`/match-history/${matchHistoryId}`, 'MatchStats');
    }
  }, [matchHistoryId]);

  useEffect(() => {
    if (sharedResultsId) {
      trackPageView(`/shared-results/${sharedResultsId}`, 'SharedResults');
    }
  }, [sharedResultsId]);

  useEffect(() => {
    if (!session && !liveMatchId && !matchHistoryId && !sharedResultsId) {
      if (showLogin) {
        trackPageView('/login', loginMode === 'signup' ? 'Signup' : 'Login');
      } else {
        trackPageView('/', 'LandingPage');
      }
    }
  }, [session, liveMatchId, matchHistoryId, sharedResultsId, showLogin, loginMode]);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'tournaments':
        return <TournamentsPage />;
      case 'matches':
        return <MatchesPage />;
      case 'clubs':
        return <ClubsPage />;
      case 'videos':
        return <VideosPage />;
      case 'video-editor':
        return <VideoEditorPage />;
      case 'rules':
        return <RulesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <LanguageProvider>
      {loading && (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-12 h-12 text-green-500 animate-spin" />
        </div>
      )}

      {!loading && liveMatchId && <LiveMatchPage matchId={liveMatchId} />}

      {!loading && matchHistoryId && <MatchHistoryPage matchId={matchHistoryId} />}

      {!loading && sharedResultsId && <SharedMatchResultsPage shareId={sharedResultsId} />}

      {!loading && !liveMatchId && !matchHistoryId && !sharedResultsId && !session && (
        <>
          {showLogin ? (
            <LoginPage
              initialMode={loginMode}
              onBack={() => setShowLogin(false)}
            />
          ) : (
            <LandingPage
              onLogin={() => {
                setLoginMode('signin');
                setShowLogin(true);
              }}
              onSignUp={() => {
                setLoginMode('signup');
                setShowLogin(true);
              }}
            />
          )}
        </>
      )}

      {!loading && !liveMatchId && !matchHistoryId && !sharedResultsId && session && (
        <AuthProvider>
          <SubscriptionProvider>
            <TournamentDataProvider>
              <PlayersProvider>
                <div className="min-h-screen bg-[#040c1a]">
                  <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
                  {renderPage()}
                </div>
              </PlayersProvider>
            </TournamentDataProvider>
          </SubscriptionProvider>
        </AuthProvider>
      )}
    </LanguageProvider>
  );
}

export default App;
