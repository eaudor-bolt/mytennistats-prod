import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, UserPlayer } from '../lib/supabase';

type PlayersContextType = {
  players: UserPlayer[];
  loading: boolean;
  refreshPlayers: () => Promise<void>;
};

const PlayersContext = createContext<PlayersContextType | undefined>(undefined);

export function PlayersProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<UserPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlayers = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_players')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading players:', error);
      setPlayers([]);
    } else {
      setPlayers(data || []);
    }

    setLoading(false);
  };

  const refreshPlayers = async () => {
    await loadPlayers();
  };

  useEffect(() => {
    loadPlayers();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      (async () => {
        if (event === 'SIGNED_IN') {
          await loadPlayers();
        } else if (event === 'SIGNED_OUT') {
          setPlayers([]);
        }
      })();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <PlayersContext.Provider value={{ players, loading, refreshPlayers }}>
      {children}
    </PlayersContext.Provider>
  );
}

export function usePlayers() {
  const context = useContext(PlayersContext);
  if (context === undefined) {
    throw new Error('usePlayers must be used within a PlayersProvider');
  }
  return context;
}
