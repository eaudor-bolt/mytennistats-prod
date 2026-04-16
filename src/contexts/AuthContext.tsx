import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      setUser(data.user);
    } catch (error) {
      console.error('Failed to refresh session:', error);
      setUser(null);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('tennis-auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error:', error);
          if (error.message.includes('refresh_token_not_found') ||
              error.message.includes('invalid_grant')) {
            await supabase.auth.signOut();
            localStorage.removeItem('tennis-auth');
          }
          throw error;
        }

        if (mounted) {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }

        if (retryCount < 2) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 1000);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        (async () => {
          if (!mounted) return;

          console.log('Auth state changed:', event);

          if (event === 'SIGNED_OUT') {
            setUser(null);
            localStorage.removeItem('tennis-auth');
          } else if (event === 'TOKEN_REFRESHED') {
            setUser(session?.user ?? null);
          } else if (event === 'SIGNED_IN') {
            setUser(session?.user ?? null);
          } else if (event === 'USER_UPDATED') {
            setUser(session?.user ?? null);
          } else {
            setUser(session?.user ?? null);
          }
        })();
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [retryCount]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
