import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import LandingHeader from '../components/landing/LandingHeader';
import { LandingHero } from '../components/landing/LandingHero';
import { LandingFeatures } from '../components/landing/LandingFeatures';
import { LandingForPlayers } from '../components/landing/LandingForPlayers';
import { LandingForCoaches } from '../components/landing/LandingForCoaches';
import { LandingPricing } from '../components/landing/LandingPricing';
import { LandingFooter } from '../components/landing/LandingFooter';

type LandingPageProps = {
  onLogin?: () => void;
  onSignUp?: () => void;
};

const CORRECT_PASSWORD = 'Sampras4Ever';
const PASSWORD_SESSION_KEY = 'landing_page_authenticated';

export function LandingPage({ onLogin, onSignUp }: LandingPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const sessionAuth = sessionStorage.getItem(PASSWORD_SESSION_KEY);
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem(PASSWORD_SESSION_KEY, 'true');
      setError('');
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050d1a] flex items-center justify-center p-4">
        <div className="bg-[#0a1526] border border-[#C8F135]/30 rounded-2xl shadow-2xl max-w-md w-full p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#C8F135]/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-[#C8F135]" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Access Required</h1>
            <p className="text-gray-400 text-center">
              Please enter the password to access the landing page
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#040b16] border border-[#C8F135]/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#C8F135] focus:ring-2 focus:ring-[#C8F135]/20 transition"
                placeholder="Enter password"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-[#C8F135] hover:bg-[#d4f855] text-black font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050d1a]">
      <LandingHeader
        onLoginClick={onLogin || (() => {})}
        onSignupClick={onSignUp || (() => {})}
      />
      <LandingHero onSignUp={onSignUp || (() => {})} />
      <LandingFeatures />
      <LandingForPlayers />
      <LandingForCoaches />
      <LandingPricing onSignUp={onSignUp || (() => {})} />
      <LandingFooter />
    </div>
  );
}
