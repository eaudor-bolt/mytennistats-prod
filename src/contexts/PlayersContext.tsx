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

  // Every account should have at least one player to pick from in the Live
  // Score / Add Match dropdowns. Nothing at the database level creates this
  // automatically on signup, so if a brand new user's first stop is Live
  // Score or Add Match (rather than Settings, which used to be the only
  // place this happened), create a default player here instead.
  //
  // This goes through an RPC (see migration ...atomic_ensure_default_player)
  // rather than a client-side "select, then insert if empty" because that
  // check-then-insert isn't atomic: on a fresh signup this component's mount
  // effect and the auth-state-change listener below both call this in quick
  // succession, and a plain client-side check would let both see zero
  // players and both insert - the RPC serializes concurrent calls per-user
  // so only one default player is ever created.
  const ensureDefaultPlayer = async (userId: string) => {
    const { error } = await supabase.rpc('ensure_default_player', { p_user_id: userId });
    if (error) {
      console.error('Error ensuring default player:', error);
    }
  };

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
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      await ensureDefaultPlayer(user.id);
      const { data: refreshed } = await supabase
        .from('user_players')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      setPlayers(refreshed || []);
    } else {
      setPlayers(data);
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
