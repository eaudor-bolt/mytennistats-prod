import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TournamentRegistration, Convocation } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type TournamentDataContextType = {
  registrations: TournamentRegistration[];
  convocations: Convocation[];
  refreshData: () => Promise<void>;
  loading: boolean;
};

const TournamentDataContext = createContext<TournamentDataContextType | undefined>(undefined);

export function TournamentDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [convocations, setConvocations] = useState<Convocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [regResult, convResult] = await Promise.all([
      supabase
        .from('tournament_registrations')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('convocations')
        .select('*')
        .eq('user_id', user.id)
        .order('convocation_date', { ascending: true })
        .order('convocation_time', { ascending: true })
    ]);

    if (regResult.data) setRegistrations(regResult.data);
    if (convResult.data) setConvocations(convResult.data);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  return (
    <TournamentDataContext.Provider value={{
      registrations,
      convocations,
      refreshData: fetchData,
      loading
    }}>
      {children}
    </TournamentDataContext.Provider>
  );
}

export function useTournamentData() {
  const context = useContext(TournamentDataContext);
  if (context === undefined) {
    throw new Error('useTournamentData must be used within a TournamentDataProvider');
  }
  return context;
}
