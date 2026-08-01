import { useState } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ResetPasswordModalProps = {
  onDone: () => void;
};

export function ResetPasswordModal({ onDone }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(onDone, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-br from-[#0a1628] to-[#050d1a] rounded-xl shadow-2xl border border-white/10 p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="relative w-7 h-7">
                <div className="absolute inset-0 rounded-full bg-[#C8F135]" />
                <div className="absolute inset-[2px] rounded-full border-2 border-[#040c1a]/40" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-px h-full bg-[#040c1a]/30 rotate-45" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white">
                myTenni<span className="text-[#C8F135]">Stats</span>
              </h1>
            </div>
            <p className="text-gray-400">Choose a new password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={success}
                  className="w-full px-4 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] transition disabled:opacity-50"
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-300 mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={success}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] transition disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
                Password updated! Redirecting...
              </div>
            )}

            <button
              type="submit"
              disabled={loading || success}
              className="w-full bg-[#C8F135] text-[#060e1b] font-bold py-3 px-6 rounded-full hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
