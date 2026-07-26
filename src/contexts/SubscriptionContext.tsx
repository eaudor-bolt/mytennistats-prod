import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type SubscriptionTier = 'free' | 'premium';

type SubscriptionLimits = {
  maxPlayers: number;
  maxMatchResults: number;
  maxShares: number;
  maxLiveShares: number;
  maxLivePoints: number;
  maxVideos: number;
  maxVideoStorageBytes: number;
  maxVideoDurationSeconds: number;
  maxRulesChatResponses: number;
};

type UserSubscription = {
  id: string;
  user_id: string;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  current_period_start: string | null;
  current_period_end: string | null;
};

type UserFeatureFlags = {
  id: string;
  user_id: string;
  can_access_tournaments: boolean;
};

type UserUsageStats = {
  id: string;
  user_id: string;
  players_created: number;
  match_results_created: number;
  shares_created: number;
  live_shares_created: number;
  live_points_recorded: number;
  videos_uploaded: number;
  video_storage_bytes: number;
  rules_chat_responses: number;
};

type UsageType = 'player' | 'match_result' | 'share' | 'live_share' | 'live_point' | 'video' | 'rules_chat';

type SubscriptionContextType = {
  subscription: UserSubscription | null;
  featureFlags: UserFeatureFlags | null;
  usageStats: UserUsageStats | null;
  limits: SubscriptionLimits;
  loading: boolean;
  canCreatePlayer: boolean;
  canCreateMatchResult: boolean;
  canShareMatch: boolean;
  canShareLive: boolean;
  canRecordLivePoint: boolean;
  canUploadVideo: boolean;
  canUseRulesChat: boolean;
  canAccessTournaments: boolean;
  hasVideoStorageRoom: (additionalBytes: number) => boolean;
  incrementUsage: (type: UsageType, extra?: { bytes?: number }) => Promise<void>;
  refreshSubscription: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const ONE_GB = 1024 * 1024 * 1024;

const FREE_LIMITS: SubscriptionLimits = {
  maxPlayers: 1,
  maxMatchResults: 3,
  maxShares: 3,
  maxLiveShares: 1,
  maxLivePoints: 3,
  maxVideos: 3,
  maxVideoStorageBytes: Infinity,
  maxVideoDurationSeconds: 60,
  maxRulesChatResponses: 3,
};

const PREMIUM_LIMITS: SubscriptionLimits = {
  maxPlayers: Infinity,
  maxMatchResults: Infinity,
  maxShares: Infinity,
  maxLiveShares: Infinity,
  maxLivePoints: Infinity,
  maxVideos: Infinity,
  maxVideoStorageBytes: ONE_GB,
  maxVideoDurationSeconds: 60,
  maxRulesChatResponses: Infinity,
};

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [featureFlags, setFeatureFlags] = useState<UserFeatureFlags | null>(null);
  const [usageStats, setUsageStats] = useState<UserUsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const limits = subscription?.subscription_tier === 'premium' ? PREMIUM_LIMITS : FREE_LIMITS;

  const fetchSubscriptionData = async () => {
    if (!user) {
      setSubscription(null);
      setFeatureFlags(null);
      setUsageStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [subResult, flagsResult, statsResult] = await Promise.all([
        supabase.from('user_subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_feature_flags').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_usage_stats').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (subResult.data) setSubscription(subResult.data);
      if (flagsResult.data) setFeatureFlags(flagsResult.data);
      if (statsResult.data) setUsageStats(statsResult.data);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSubscriptionData();
    }
  }, [user?.id]);

  const incrementUsage = async (type: UsageType, extra?: { bytes?: number }) => {
    if (!user || !usageStats) return;

    const fieldMap: Record<UsageType, keyof UserUsageStats> = {
      player: 'players_created',
      match_result: 'match_results_created',
      share: 'shares_created',
      live_share: 'live_shares_created',
      live_point: 'live_points_recorded',
      video: 'videos_uploaded',
      rules_chat: 'rules_chat_responses',
    };

    const field = fieldMap[type];
    const newValue = (usageStats[field] as number) + 1;

    const updatePayload: Record<string, unknown> = {
      [field]: newValue,
      updated_at: new Date().toISOString(),
    };

    let newStorageBytes = usageStats.video_storage_bytes;
    if (type === 'video' && extra?.bytes) {
      newStorageBytes = usageStats.video_storage_bytes + extra.bytes;
      updatePayload.video_storage_bytes = newStorageBytes;
    }

    const { error } = await supabase
      .from('user_usage_stats')
      .update(updatePayload)
      .eq('user_id', user.id);

    if (!error) {
      setUsageStats({ ...usageStats, [field]: newValue, video_storage_bytes: newStorageBytes });
    }
  };

  const refreshSubscription = async () => {
    await fetchSubscriptionData();
  };

  const canCreatePlayer = !usageStats || usageStats.players_created < limits.maxPlayers;
  const canCreateMatchResult = !usageStats || usageStats.match_results_created < limits.maxMatchResults;
  const canShareMatch = !usageStats || usageStats.shares_created < limits.maxShares;
  const canShareLive = !usageStats || usageStats.live_shares_created < limits.maxLiveShares;
  const canRecordLivePoint = !usageStats || usageStats.live_points_recorded < limits.maxLivePoints;
  const canUploadVideo = !usageStats || usageStats.videos_uploaded < limits.maxVideos;
  const canUseRulesChat = !usageStats || usageStats.rules_chat_responses < limits.maxRulesChatResponses;
  const canAccessTournaments = featureFlags?.can_access_tournaments || false;

  const hasVideoStorageRoom = (additionalBytes: number): boolean => {
    if (limits.maxVideoStorageBytes === Infinity) return true;
    const currentBytes = usageStats?.video_storage_bytes || 0;
    return currentBytes + additionalBytes <= limits.maxVideoStorageBytes;
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        featureFlags,
        usageStats,
        limits,
        loading,
        canCreatePlayer,
        canCreateMatchResult,
        canShareMatch,
        canShareLive,
        canRecordLivePoint,
        canUploadVideo,
        canUseRulesChat,
        canAccessTournaments,
        hasVideoStorageRoom,
        incrementUsage,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
