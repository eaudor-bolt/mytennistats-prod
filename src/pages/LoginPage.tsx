import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { SubscriptionSelectionModal } from '../components/SubscriptionSelectionModal';

type LoginPageProps = {
  initialMode?: 'signin' | 'signup';
  onBack?: () => void;
};

export function LoginPage({ initialMode = 'signin', onBack }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (resetError) {
          setError(resetError.message);
        } else {
          setSuccess('Password reset email sent! Check your inbox.');
          setIsForgotPassword(false);
        }
        setLoading(false);
        return;
      }

      if (isSignUp) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              language: 'en',
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        if (signUpData.user) {
          if (birthYear) {
            await supabase
              .from('user_profiles')
              .update({ birth_year: parseInt(birthYear) })
              .eq('id', signUpData.user.id);
          }
          setShowSubscriptionModal(true);
        }

        setLoading(false);
        return;
      } else {
        localStorage.removeItem('tennis-auth');

        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            setError('Invalid email or password. Please try again.');
          } else if (signInError.message.includes('Email not confirmed')) {
            setError('Please verify your email before signing in.');
          } else {
            setError(signInError.message);
          }
          setLoading(false);
          return;
        }

        if (data.session) {
          console.log('Sign in successful, session created');
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFree = async () => {
    setShowSubscriptionModal(false);
    await supabase.auth.signOut();
    setSuccess('Account created successfully with Free plan! Please check your email to verify your account, then log in.');
    setIsSignUp(false);
  };

  const handleSelectPremium = async () => {
    setShowSubscriptionModal(false);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expired. Please sign in again.');
        return;
      }

      const priceId = import.meta.env.VITE_STRIPE_PRICE_ID;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ priceId }),
        }
      );

      const { url, error: checkoutError } = await response.json();

      if (checkoutError) {
        setError('Error creating checkout session: ' + checkoutError);
      } else if (url) {
        await supabase.auth.signOut();
        alert('Please complete the payment process. After payment, check your email to verify your account, then log in.');
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      setError('Error upgrading subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050d1a] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#C8F135]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#C8F135]/3 rounded-full blur-3xl" />
      </div>
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors z-10"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </button>
      )}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-gradient-to-br from-[#0a1628] to-[#050d1a] rounded-xl shadow-2xl border border-white/10 p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="relative w-7 h-7">
                <div className="absolute inset-0 rounded-full bg-[#C8F135]"></div>
                <div className="absolute inset-[2px] rounded-full border-2 border-[#040c1a]/40"></div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-px h-full bg-[#040c1a]/30 rotate-45"></div>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white">
                myTenni<span className="text-[#C8F135]">Stats</span>
              </h1>
            </div>
            <p className="text-gray-400">
              {isForgotPassword
                ? 'Reset your password'
                : isSignUp
                ? 'Create your account'
                : 'Sign in to your account'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && !isForgotPassword && (
              <>
                <div>
                  <label htmlFor="firstName" className="block text-sm font-semibold text-gray-300 mb-1.5">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] transition"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-semibold text-gray-300 mb-1.5">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] transition"
                    placeholder="Doe"
                  />
                </div>
                <div>
                  <label htmlFor="birthYear" className="block text-sm font-semibold text-gray-300 mb-1.5">
                    Birth Year
                  </label>
                  <input
                    id="birthYear"
                    type="number"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    min="1900"
                    max={new Date().getFullYear()}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] transition"
                    placeholder="1990"
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-300 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] transition"
                placeholder="you@example.com"
              />
            </div>

            {!isForgotPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] transition"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {!isForgotPassword && !isSignUp && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-[#C8F135] hover:text-[#d4f54d] font-medium"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C8F135] text-[#060e1b] font-bold py-3 px-6 rounded-full hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isForgotPassword
                ? 'Send Reset Link'
                : isSignUp
                ? 'Create account'
                : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center">
            {isForgotPassword ? (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setError('');
                  setSuccess('');
                }}
                className="text-sm text-gray-400 hover:text-gray-300"
              >
                Back to sign in
              </button>
            ) : (
              <p className="text-gray-400 text-sm">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-[#C8F135] hover:text-[#d4f54d] font-semibold"
                >
                  {isSignUp ? 'Sign in' : 'Create one'}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {showSubscriptionModal && (
        <SubscriptionSelectionModal
          onSelectFree={handleSelectFree}
          onSelectPremium={handleSelectPremium}
          onClose={() => {
            setShowSubscriptionModal(false);
            handleSelectFree();
          }}
        />
      )}
    </div>
  );
}
