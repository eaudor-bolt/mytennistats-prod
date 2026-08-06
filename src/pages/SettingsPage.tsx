import { Bell, Globe, User, Mail, Shield, Users, Plus, CreditCard as Edit2, Trash2, Eye, EyeOff, X, CreditCard, Check, Sparkles, LogOut, Database, Share2, ExternalLink, HardDrive, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase, UserPlayer } from '../lib/supabase';
import { usePlayers } from '../contexts/PlayersContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { importTenupMatchResults } from '../utils/importTenupMatchResults';
import { ImportPlayerSelectionModal } from '../components/ImportPlayerSelectionModal';
import { useAlert } from '../hooks/useAlert';
import { deleteAccount } from '../utils/deleteAccount';

type PlayerFormData = {
  first_name: string;
  last_name: string;
  license_number: string;
  birth_year: string;
};

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDuration = (totalSeconds: number): string => {
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export function SettingsPage() {
  const { players, refreshPlayers } = usePlayers();
  const { language, setLanguage, t } = useLanguage();
  const { subscription, usageStats, limits, canAccessTournaments, canCreatePlayer, incrementUsage, refreshSubscription } = useSubscription();
  const { signOut } = useAuth();
  const { showAlert, AlertComponent } = useAlert();
  const [notifications, setNotifications] = useState(true);
  const [upgradingSubscription, setUpgradingSubscription] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [email, setEmail] = useState('');
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<UserPlayer | null>(null);
  const [playerForm, setPlayerForm] = useState<PlayerFormData>({ first_name: '', last_name: '', license_number: '', birth_year: '' });
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showDeletePlayerModal, setShowDeletePlayerModal] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<UserPlayer | null>(null);
  const [deletingPlayer, setDeletingPlayer] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isTenupImportModalOpen, setIsTenupImportModalOpen] = useState(false);
  const [sharedLinks, setSharedLinks] = useState<Array<{
    id: string;
    type: 'Live Score' | 'Match Result' | 'Match History';
    url: string;
    created_at: string;
    player_names?: string[];
    view_count: number;
  }>>([]);
  const [loadingSharedLinks, setLoadingSharedLinks] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [videoUsage, setVideoUsage] = useState<{ totalBytes: number; totalSeconds: number; count: number } | null>(null);
  const [loadingVideoUsage, setLoadingVideoUsage] = useState(false);

  useEffect(() => {
    loadUserData();
    loadSettings();
    handleReturnFromStripe();
    loadSharedLinks();
    loadVideoUsage();
  }, []);

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || '');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, birth_year')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setFirstName(profile.first_name || '');
        setLastName(profile.last_name || '');
        setBirthYear(profile.birth_year ? profile.birth_year.toString() : '');
      } else {
        const authFirstName = user.user_metadata?.first_name || '';
        const authLastName = user.user_metadata?.last_name || '';
        setFirstName(authFirstName);
        setLastName(authLastName);
      }
    }
  };


  const loadSettings = () => {
    const savedNotifications = localStorage.getItem('notifications') !== 'false';
    setNotifications(savedNotifications);
  };

  const handleReturnFromStripe = async () => {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const success = urlParams.get('success');
    const sessionId = urlParams.get('session_id');

    if (success === 'true' && sessionId) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refreshSubscription();

      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);

      showAlert(t('settings.subscription.welcomePremium'), { type: 'success' });
    }
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          birth_year: birthYear ? parseInt(birthYear) : null,
          language: language
        })
        .eq('id', user.id);

      await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          language: language
        }
      });

      localStorage.setItem('notifications', notifications.toString());

      showAlert(t('settings.updateProfile'), { type: 'success' });
    } catch (error) {
      console.error('Error saving settings:', error);
      showAlert(t('settings.errors.saveSettings'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!playerForm.first_name || !playerForm.birth_year) {
      showAlert(t('settings.playersSection.errorMissingFields'), { type: 'warning' });
      return;
    }

    if (!canCreatePlayer) {
      showAlert(t('settings.playersSection.limitReached').replace('{n}', String(limits.maxPlayers)), { type: 'warning' });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_players')
      .insert({
        user_id: user.id,
        first_name: playerForm.first_name,
        last_name: playerForm.last_name || '',
        license_number: playerForm.license_number || '',
        birth_year: parseInt(playerForm.birth_year),
      });

    if (!error) {
      await incrementUsage('player');
      setPlayerForm({ first_name: '', last_name: '', license_number: '', birth_year: '' });
      setShowAddPlayer(false);
      await refreshPlayers();
    } else {
      showAlert(t('settings.playersSection.errorAdding'), { type: 'error' });
    }
  };

  const handleUpdatePlayer = async () => {
    if (!editingPlayer || !playerForm.first_name || !playerForm.birth_year) return;

    const { error} = await supabase
      .from('user_players')
      .update({
        first_name: playerForm.first_name,
        last_name: playerForm.last_name || '',
        license_number: playerForm.license_number || '',
        birth_year: parseInt(playerForm.birth_year),
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingPlayer.id);

    if (!error) {
      setPlayerForm({ first_name: '', last_name: '', license_number: '', birth_year: '' });
      setEditingPlayer(null);
      await refreshPlayers();
    } else {
      showAlert(t('settings.playersSection.errorUpdating'), { type: 'error' });
    }
  };

  const handleDeletePlayer = async (player: UserPlayer) => {
    setPlayerToDelete(player);
    setShowDeletePlayerModal(true);
  };

  const handleDeletePlayerOnly = async () => {
    if (!playerToDelete) return;

    setDeletingPlayer(true);
    try {
      const { error } = await supabase
        .from('user_players')
        .delete()
        .eq('id', playerToDelete.id);

      if (error) {
        showAlert(t('settings.playersSection.errorDeleting'), { type: 'error' });
        return;
      }

      await refreshPlayers();
      showAlert(t('settings.playersSection.deletedSuccess'), { type: 'success' });
      setShowDeletePlayerModal(false);
      setPlayerToDelete(null);
    } catch (error) {
      console.error('Error:', error);
      showAlert(t('settings.playersSection.errorDeleting'));
    } finally {
      setDeletingPlayer(false);
    }
  };

  const handleDeletePlayerAndResults = async () => {
    if (!playerToDelete) return;

    setDeletingPlayer(true);
    try {
      const displayName = `${playerToDelete.first_name} ${playerToDelete.last_name.charAt(0).toUpperCase()}.`;

      const { error: resultsError } = await supabase
        .from('match_results')
        .delete()
        .eq('player_name', displayName);

      if (resultsError) {
        console.error('Error deleting match results:', resultsError);
      }

      const { error: playerError } = await supabase
        .from('user_players')
        .delete()
        .eq('id', playerToDelete.id);

      if (playerError) {
        showAlert(t('settings.playersSection.errorDeleting'), { type: 'error' });
        return;
      }

      await refreshPlayers();
      showAlert(t('settings.playersSection.deletedWithResultsSuccess'), { type: 'success' });
      setShowDeletePlayerModal(false);
      setPlayerToDelete(null);
    } catch (error) {
      console.error('Error:', error);
      showAlert(t('settings.playersSection.errorDeletingWithResults'), { type: 'error' });
    } finally {
      setDeletingPlayer(false);
    }
  };

  const startEditPlayer = (player: UserPlayer) => {
    setEditingPlayer(player);
    setPlayerForm({
      first_name: player.first_name,
      last_name: player.last_name,
      license_number: player.license_number,
      birth_year: player.birth_year.toString(),
    });
    setShowAddPlayer(false);
  };

  const handleChangePassword = async () => {
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('settings.modals.changePassword.errorMissingFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.modals.changePassword.errorMismatch'));
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(t('settings.modals.changePassword.errorTooShort'));
      return;
    }

    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        setPasswordError(error.message);
      } else {
        showAlert(t('settings.modals.changePassword.success'), { type: 'success' });
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      setPasswordError(t('settings.modals.changePassword.errorGeneric'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUpgradeSubscription = async () => {
    setUpgradingSubscription(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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

      const { url, error } = await response.json();

      if (error) {
        showAlert(t('settings.subscription.checkoutErrorPrefix') + error, { type: 'error' });
      } else if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      showAlert(t('settings.subscription.upgradeError'), { type: 'error' });
    } finally {
      setUpgradingSubscription(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm(t('settings.subscription.cancelConfirm'))) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (result.error) {
        showAlert(t('settings.subscription.cancelErrorPrefix') + result.error, { type: 'error' });
      } else {
        showAlert(t('settings.subscription.cancelSuccess'), { type: 'success' });
        window.location.reload();
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      showAlert(t('settings.subscription.cancelError'), { type: 'error' });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showAlert(t('settings.modals.deleteAccount.errorConfirmText'), { type: 'warning' });
      return;
    }

    setDeletingAccount(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut();

      showAlert(t('settings.modals.deleteAccount.success'), { type: 'success' });
      window.location.href = '/';
    } catch (error) {
      console.error('Error deleting account:', error);
      showAlert(t('settings.modals.deleteAccount.errorGeneric'), { type: 'error' });
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleTenupImportClick = () => {
    setIsTenupImportModalOpen(true);
  };

  const handleTenupPlayerSelected = async (playerId: string, playerName: string) => {
    try {
      const result = await importTenupMatchResults(playerId, playerName);
      if (result) {
        showAlert(t('settings.dataImport.tenup.successMessage')
          .replace('{success}', String(result.successCount))
          .replace('{duplicates}', String(result.duplicateCount))
          .replace('{errors}', String(result.errorCount)), { type: 'success' });
      }
    } catch (error) {
      console.error('Error importing TenUp data:', error);
      showAlert(t('settings.dataImport.tenup.errorMessage'), { type: 'error' });
    }
  };

  const loadSharedLinks = async () => {
    setLoadingSharedLinks(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        setLoadingSharedLinks(false);
        return;
      }

      console.log('Loading shared links for user:', user.id);

      const links: Array<{
        id: string;
        type: 'Live Score' | 'Match Result' | 'Match History';
        url: string;
        created_at: string;
        player_names?: string[];
        view_count: number;
      }> = [];

      const { data: liveMatches, error: liveError } = await supabase
        .from('live_matches')
        .select('id, player_name, created_at, user_id, view_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (liveError) {
        console.error('Error fetching live matches:', liveError);
      } else {
        console.log('Live matches found:', liveMatches?.length || 0);
        if (liveMatches) {
          liveMatches.forEach(match => {
            links.push({
              id: match.id,
              type: 'Live Score',
              url: `${window.location.origin}/shared-livescore/${match.id}`,
              created_at: match.created_at,
              player_names: [match.player_name],
              view_count: match.view_count || 0
            });
          });
        }
      }

      const { data: sharedResults, error: sharedError } = await supabase
        .from('shared_match_results')
        .select('id, player_names, created_at, user_id, view_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (sharedError) {
        console.error('Error fetching shared match results:', sharedError);
      } else {
        console.log('Shared match results found:', sharedResults?.length || 0);
        if (sharedResults) {
          sharedResults.forEach(result => {
            links.push({
              id: result.id,
              type: 'Match Result',
              url: `${window.location.origin}/shared-results/${result.id}`,
              created_at: result.created_at,
              player_names: result.player_names || [],
              view_count: result.view_count || 0
            });
          });
        }
      }

      // Individual match shares ("shared-game" links) have no dedicated
      // share-event table - shared_at on the match itself is what marks it
      // as ever having been shared (see MatchesPage's onShareIndividual).
      const { data: sharedGames, error: sharedGameError } = await supabase
        .from('match_results')
        .select('id, player_name, created_at, shared_at, user_id, view_count')
        .eq('user_id', user.id)
        .not('shared_at', 'is', null)
        .order('shared_at', { ascending: false });

      if (sharedGameError) {
        console.error('Error fetching shared games:', sharedGameError);
      } else {
        console.log('Shared games found:', sharedGames?.length || 0);
        if (sharedGames) {
          sharedGames.forEach(match => {
            links.push({
              id: match.id,
              type: 'Match History',
              url: `${window.location.origin}/shared-game/${match.id}`,
              created_at: match.shared_at || match.created_at,
              player_names: [match.player_name],
              view_count: match.view_count || 0
            });
          });
        }
      }

      links.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      console.log('Total links loaded:', links.length);
      setSharedLinks(links);
    } catch (error) {
      console.error('Error loading shared links:', error);
    } finally {
      setLoadingSharedLinks(false);
    }
  };

  const loadVideoUsage = async () => {
    setLoadingVideoUsage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingVideoUsage(false);
        return;
      }

      const { data: videoRows } = await supabase
        .from('videos')
        .select('url, size_bytes, duration_seconds')
        .eq('user_id', user.id);

      const knownUrls = new Set<string>();
      let totalBytes = 0;
      let totalSeconds = 0;
      let count = 0;

      (videoRows || []).forEach(v => {
        if (v.url) knownUrls.add(v.url);
        totalBytes += v.size_bytes || 0;
        totalSeconds += v.duration_seconds || 0;
        count += 1;
      });

      // Point clips recorded during a live match but never "favorited" only
      // live inline inside scoring_history (no row in `videos`) — count them
      // too, skipping any URL already counted above to avoid double-counting
      // once a clip has been promoted into the videos table.
      const [{ data: liveMatches }, { data: matchResults }] = await Promise.all([
        supabase.from('live_matches').select('scoring_history').eq('user_id', user.id),
        supabase.from('match_results').select('scoring_history').eq('user_id', user.id),
      ]);

      [...(liveMatches || []), ...(matchResults || [])].forEach(row => {
        const points = Array.isArray(row.scoring_history) ? row.scoring_history : [];
        points.forEach((point: any) => {
          if (point?.videoUrl && point?.sizeBytes && !knownUrls.has(point.videoUrl)) {
            knownUrls.add(point.videoUrl);
            totalBytes += point.sizeBytes;
            totalSeconds += point.duration || 0;
            count += 1;
          }
        });
      });

      setVideoUsage({ totalBytes, totalSeconds, count });
    } catch (error) {
      console.error('Error loading video usage:', error);
    } finally {
      setLoadingVideoUsage(false);
    }
  };

  const deleteSharedLink = async (id: string, type: 'Live Score' | 'Match Result' | 'Match History') => {
    showAlert(t('settings.sharedLinks.deleteConfirmMessage'), {
      type: 'warning',
      title: t('settings.sharedLinks.deleteConfirmTitle'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        setDeletingLinkId(id);
        try {
          if (type === 'Match History') {
            // There's no separate row for this share - the match itself
            // (match_results) is what's shared, via shared_at. "Deleting
            // the link" means un-sharing it, not deleting the match.
            const { error } = await supabase
              .from('match_results')
              .update({ shared_at: null })
              .eq('id', id);
            if (error) throw error;
          } else {
            const tableName = type === 'Live Score' ? 'live_matches' : 'shared_match_results';
            const { error } = await supabase
              .from(tableName)
              .delete()
              .eq('id', id);
            if (error) throw error;
          }

          setSharedLinks(prev => prev.filter(link => link.id !== id));
          showAlert(t('settings.sharedLinks.deleteSuccess'), { type: 'success' });
        } catch (error) {
          console.error('Error deleting shared link:', error);
          showAlert(t('settings.sharedLinks.deleteError'), { type: 'error' });
        } finally {
          setDeletingLinkId(null);
        }
      }
    });
  };

  return (
    <>
      <AlertComponent />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#C8F135] mb-2">{t('settings.title')}</h2>
        <nav className="bg-white/5 border border-white/10 rounded-xl p-4 mt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('settings.quickLinks.title')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {[
              { id: 'profile-information', label: t('settings.profileSection.title') },
              { id: 'players', label: t('settings.players') },
              { id: 'language-region', label: t('settings.languageRegion.title') },
              { id: 'data-import', label: t('settings.dataImport.title') },
              { id: 'video-storage', label: t('settings.videoUsage.title') },
              { id: 'shared-links', label: t('settings.sharedLinks.title') },
              { id: 'subscription-plan', label: t('settings.subscription.title') },
              { id: 'privacy-security', label: t('settings.security.title') },
              { id: 'logout', label: t('nav.logout') },
              { id: 'danger-zone', label: t('settings.quickLinks.dangerZone') },
            ].map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(link.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="text-sm text-gray-300 hover:text-[#C8F135] transition-colors py-1 px-2 rounded hover:bg-white/5"
              >
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      </div>

      <div className="space-y-6">

        <div id="profile-information" className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400 scroll-mt-24">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <User className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('settings.profileSection.title')}</h3>
            </div>
            <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-400">
                {t('settings.firstName')}
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-white hover:border-white/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-400">
                {t('settings.lastName')}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-white hover:border-white/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-400">
                {t('settings.yearOfBirth')}
              </label>
              <input
                type="number"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                min="1900"
                max={new Date().getFullYear()}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-white hover:border-white/20"
                placeholder="1990"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-400">
                {t('settings.profileSection.email')}
              </label>
              <div className="flex items-center">
                <Mail className="w-5 h-5 mr-2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="flex-1 px-4 py-2 border rounded-lg border-gray-300 bg-gray-50 text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 mt-6">
        <div id="players" className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400 scroll-mt-24">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('settings.players')}</h3>
            </div>
            <div className="space-y-4">
            {players.map((player) => (
              <div key={player.id}>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                  <div>
                    <p className={`font-medium text-white`}>{player.first_name} {player.last_name}</p>
                    <p className={`text-sm text-gray-400`}>{t('settings.playersSection.birthYearDisplay').replace('{n}', String(player.birth_year))}</p>
                    {player.license_number && (
                      <p className="text-sm text-gray-500">{t('settings.playersSection.licenseDisplay').replace('{n}', player.license_number)}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEditPlayer(player)}
                      className="p-2 text-[#C8F135] hover:bg-[#C8F135]/10 rounded-lg transition-colors"
                      title={t('common.edit')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePlayer(player)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {editingPlayer?.id === player.id && (
                  <div className="mt-3 p-4 border-2 rounded-xl border-[#C8F135]/30 bg-[#C8F135]/5">
                    <h4 className={`font-semibold mb-3 text-white`}>{t('settings.playersSection.editTitle')}</h4>
                    <div className="space-y-3">
                      <div>
                        <label className={`block text-sm font-medium mb-1 text-gray-300`}>{t('settings.playersSection.firstNameRequired')}</label>
                        <input
                          type="text"
                          value={playerForm.first_name}
                          onChange={(e) => setPlayerForm({ ...playerForm, first_name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                          placeholder="First name"
                          required
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-1 text-gray-300`}>{t('settings.lastName')}</label>
                        <input
                          type="text"
                          value={playerForm.last_name}
                          onChange={(e) => setPlayerForm({ ...playerForm, last_name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                          placeholder="Last name"
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-1 text-gray-300`}>{t('settings.playersSection.licenseNumberLabel')}</label>
                        <input
                          type="text"
                          value={playerForm.license_number}
                          onChange={(e) => setPlayerForm({ ...playerForm, license_number: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                          placeholder={t('settings.playersSection.licenseNumberPlaceholder')}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-1 text-gray-300`}>{t('settings.playersSection.birthYearRequired')}</label>
                        <input
                          type="number"
                          value={playerForm.birth_year}
                          onChange={(e) => setPlayerForm({ ...playerForm, birth_year: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                          placeholder="YYYY"
                          min="1900"
                          max={new Date().getFullYear()}
                          required
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleUpdatePlayer}
                          className="flex-1 px-6 py-3 bg-[#C8F135] text-[#040c1a] font-bold rounded-full hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20"
                        >
                          {t('settings.playersSection.update')}
                        </button>
                        <button
                          onClick={() => {
                            setEditingPlayer(null);
                            setPlayerForm({ first_name: '', last_name: '', license_number: '', birth_year: '' });
                          }}
                          className="px-6 py-3 border-2 border-white/20 text-gray-300 font-bold rounded-full hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {showAddPlayer && !editingPlayer && (
              <div className="p-4 border-2 rounded-xl border-[#C8F135]/30 bg-[#C8F135]/5">
                <h4 className={`font-semibold mb-3 text-white`}>{t('settings.addPlayer')}</h4>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 text-gray-300`}>{t('settings.playersSection.firstNameRequired')}</label>
                    <input
                      type="text"
                      value={playerForm.first_name}
                      onChange={(e) => setPlayerForm({ ...playerForm, first_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                      placeholder="First name"
                      required
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 text-gray-300`}>{t('settings.lastName')}</label>
                    <input
                      type="text"
                      value={playerForm.last_name}
                      onChange={(e) => setPlayerForm({ ...playerForm, last_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                      placeholder="Last name"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 text-gray-300`}>{t('settings.playersSection.licenseNumberLabel')}</label>
                    <input
                      type="text"
                      value={playerForm.license_number}
                      onChange={(e) => setPlayerForm({ ...playerForm, license_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                      placeholder={t('settings.playersSection.licenseNumberPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 text-gray-300`}>{t('settings.playersSection.birthYearRequired')}</label>
                    <input
                      type="number"
                      value={playerForm.birth_year}
                      onChange={(e) => setPlayerForm({ ...playerForm, birth_year: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                      placeholder="YYYY"
                      min="1900"
                      max={new Date().getFullYear()}
                      required
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleAddPlayer}
                      className="flex-1 px-6 py-3 bg-[#C8F135] text-[#040c1a] font-bold rounded-full hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20"
                    >
                      {t('settings.playersSection.add')}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddPlayer(false);
                        setPlayerForm({ first_name: '', last_name: '', license_number: '', birth_year: '' });
                      }}
                      className="px-6 py-3 border-2 border-white/20 text-gray-300 font-bold rounded-full hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!showAddPlayer && !editingPlayer && (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (!canCreatePlayer) {
                      showAlert(t('settings.playersSection.limitReached').replace('{n}', String(limits.maxPlayers)), { type: 'warning' });
                    } else {
                      setShowAddPlayer(true);
                    }
                  }}
                  className="w-full px-6 py-3 bg-[#C8F135]/20 hover:bg-[#C8F135]/30 text-[#C8F135] font-bold rounded-full transition-all duration-300 hover:scale-105 border border-[#C8F135]/30 flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {t('settings.addPlayer')}
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
{/*
        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('settings.notifications.title')}</h3>
            </div>
            <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-medium text-white`}>{t('settings.notifications.pushTitle')}</p>
                <p className={`text-sm text-gray-400`}>{t('settings.notifications.pushDesc')}</p>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications ? 'bg-[#C8F135]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="border-t pt-4 border-gray-100">
              <div className="space-y-2">
                <label className="flex items-center">
                  <input type="checkbox" defaultChecked className="rounded text-green-600 focus:ring-green-500" />
                  <span className="ml-2 text-sm text-gray-300">{t('settings.notifications.matchStart')}</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" defaultChecked className="rounded text-green-600 focus:ring-green-500" />
                  <span className="ml-2 text-sm text-gray-300">{t('settings.notifications.tournamentUpdates')}</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="rounded text-green-600 focus:ring-green-500" />
                  <span className="ml-2 text-sm text-gray-300">{t('settings.notifications.playerNews')}</span>
                </label>
              </div>
            </div>
            </div>
          </div>
        </div>
*/}
        <div id="language-region" className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400 scroll-mt-24">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('settings.languageRegion.title')}</h3>
            </div>
            <label className="block text-sm font-medium mb-2 text-gray-400">
              {t('settings.language')}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'fr' | 'en')}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none transition-all bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
            >
              <option value="en" className="bg-[#0a1628] text-gray-300">{t('settings.english')}</option>
              <option value="fr" className="bg-[#0a1628] text-gray-300">{t('settings.french')}</option>
            </select>
          </div>
        </div>

        <div id="data-import" className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400 scroll-mt-24">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('settings.dataImport.title')}</h3>
            </div>
            <div className="space-y-6">
            <div>
              <h4 className={`font-semibold mb-2 text-white`}>{t('settings.dataImport.tenup.title')}</h4>
              <p className={`text-sm mb-4 text-gray-400`}>
                {t('settings.dataImport.tenup.desc')}
              </p>
              <button
                onClick={handleTenupImportClick}
                className="w-full px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-bold rounded-full transition-all duration-300 hover:scale-105 border border-purple-400/30"
              >
                {t('settings.dataImport.tenup.importButton')}
              </button>
            </div>
            </div>
          </div>
        </div>

        <div id="video-storage" className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400 scroll-mt-24">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('settings.videoUsage.title')}</h3>
            </div>
            <p className="text-sm mb-4 text-gray-400">
              {t('settings.videoUsage.desc')}
            </p>

            {loadingVideoUsage ? (
              <div className="text-center py-6">
                <p className="text-gray-400">{t('settings.videoUsage.loading')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl p-4 bg-white/2 border border-white/5">
                  <p className="text-xs text-gray-400 mb-1">{t('settings.videoUsage.totalStorage')}</p>
                  <p className="text-xl font-bold text-white">{formatBytes(videoUsage?.totalBytes || 0)}</p>
                </div>
                <div className="rounded-xl p-4 bg-white/2 border border-white/5">
                  <p className="text-xs text-gray-400 mb-1">{t('settings.videoUsage.totalVideos')}</p>
                  <p className="text-xl font-bold text-white">{videoUsage?.count || 0}</p>
                </div>
                <div className="rounded-xl p-4 bg-white/2 border border-white/5">
                  <p className="text-xs text-gray-400 mb-1">{t('settings.videoUsage.totalDuration')}</p>
                  <p className="text-xl font-bold text-white">{formatDuration(videoUsage?.totalSeconds || 0)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div id="shared-links" className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400 scroll-mt-24">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('settings.sharedLinks.title')}</h3>
            </div>
            <p className={`text-sm mb-4 text-gray-400`}>
              {t('settings.sharedLinks.desc')}
            </p>

            {loadingSharedLinks ? (
              <div className="text-center py-8">
                <p className={false ? 'text-gray-400' : 'text-gray-600'}>{t('settings.sharedLinks.loading')}</p>
              </div>
            ) : sharedLinks.length === 0 ? (
              <div className="text-center py-8">
                <p className={false ? 'text-gray-400' : 'text-gray-600'}>{t('settings.sharedLinks.empty')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${false ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-2 text-sm font-semibold text-gray-300`}>{t('settings.sharedLinks.colType')}</th>
                      <th className={`text-left py-3 px-2 text-sm font-semibold text-gray-300`}>{t('settings.sharedLinks.colPlayers')}</th>
                      <th className={`text-left py-3 px-2 text-sm font-semibold text-gray-300`}>{t('settings.sharedLinks.colCreated')}</th>
                      <th className={`text-left py-3 px-2 text-sm font-semibold text-gray-300`}>{t('settings.sharedLinks.colUrl')}</th>
                      <th className={`text-center py-3 px-2 text-sm font-semibold text-gray-300`}>{t('settings.sharedLinks.colViews')}</th>
                      <th className={`text-center py-3 px-2 text-sm font-semibold text-gray-300`}>{t('settings.sharedLinks.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sharedLinks.map((link) => (
                      <tr key={link.id} className={`border-b ${false ? 'border-gray-800' : 'border-gray-100'}`}>
                        <td className="py-3 px-2">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            link.type === 'Live Score'
                              ? 'bg-green-100 text-green-700'
                              : link.type === 'Match Result'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {link.type === 'Live Score'
                              ? t('settings.sharedLinks.typeLiveScore')
                              : link.type === 'Match Result'
                              ? t('settings.sharedLinks.typeMatchResult')
                              : t('settings.sharedLinks.typeMatchHistory')}
                          </span>
                        </td>
                        <td className={`py-3 px-2 text-sm text-gray-300`}>
                          {link.player_names && link.player_names.length > 0 ? link.player_names.join(', ') : '-'}
                        </td>
                        <td className={`py-3 px-2 text-sm text-gray-400`}>
                          {new Date(link.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                        </td>
                        <td className="py-3 px-2">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                            title={link.url}
                          >
                            <span className="truncate max-w-[150px]">{link.url.substring(link.url.lastIndexOf('/') + 1)}</span>
                            <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                          </a>
                        </td>
                        <td className="py-3 px-2">
                          <span className="flex items-center justify-center gap-1 text-sm font-medium text-gray-300">
                            <Eye className="w-3.5 h-3.5 text-gray-500" />
                            {link.view_count}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={async () => {
                                await navigator.clipboard.writeText(link.url);
                                showAlert(t('settings.sharedLinks.copySuccessMessage'), {
                                  type: 'success',
                                  title: t('settings.sharedLinks.copySuccessTitle'),
                                  link: link.url
                                });
                              }}
                              className="p-1 text-[#C8F135] hover:bg-[#C8F135]/10 rounded transition-colors"
                              title={t('settings.sharedLinks.copyLinkTitle')}
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteSharedLink(link.id, link.type)}
                              disabled={deletingLinkId === link.id}
                              className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={t('common.delete')}
                            >
                              {deletingLinkId === link.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>



        <div id="subscription-plan" className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400 scroll-mt-24">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('settings.subscription.title')}</h3>
            </div>
            {subscription?.subscription_tier === 'free' ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className={`text-lg font-bold text-white`}>{t('settings.subscription.freePlan')}</h4>
                    <p className={`text-sm mt-1 text-gray-400`}>{t('settings.subscription.freeDesc')}</p>
                  </div>
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-white/5 text-gray-400 border border-white/10">
                    {t('settings.subscription.currentPlan')}
                  </span>
                </div>

                <div className="rounded-xl p-4 space-y-2 bg-white/2 border border-white/5">
                  <h5 className="font-semibold mb-3 text-white">{t('settings.subscription.currentUsage')}</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('settings.subscription.playersCreated')}</span>
                      <span className="font-medium text-white">{usageStats?.players_created || 0} / {limits.maxPlayers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('settings.subscription.matchResultsCreated')}</span>
                      <span className="font-medium text-white">{usageStats?.match_results_created || 0} / {limits.maxMatchResults}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('settings.subscription.sharesCreated')}</span>
                      <span className="font-medium text-white">{usageStats?.shares_created || 0} / {limits.maxShares}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('settings.subscription.liveGameSharing')}</span>
                      <span className={`font-medium ${(usageStats?.live_shares_created || 0) > 0 ? 'text-gray-400' : 'text-[#C8F135]'}`}>
                        {(usageStats?.live_shares_created || 0) > 0 ? t('settings.subscription.used') : t('settings.subscription.notUsed')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('settings.subscription.livePointsRecorded')}</span>
                      <span className="font-medium text-white">{usageStats?.live_points_recorded || 0} / {limits.maxLivePoints}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('settings.subscription.videosUploaded')}</span>
                      <span className="font-medium text-white">{usageStats?.videos_uploaded || 0} / {limits.maxVideos}</span>
                    </div>
                    {canAccessTournaments && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('settings.subscription.tournamentAccess')}</span>
                        <span className="font-medium text-[#C8F135]">{t('settings.subscription.enabled')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4 border-white/5">
                  <div className="rounded-xl p-6 border border-[#C8F135]/20 bg-[#C8F135]/5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[#C8F135]/20 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-[#C8F135]" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold mb-1 text-white">{t('settings.subscription.upgradeTitle')}</h4>
                        <p className="text-sm mb-3 text-gray-400">{t('settings.subscription.upgradeDesc')}</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-300">
                        <Check className="w-4 h-4 text-[#C8F135] mr-2 flex-shrink-0" />
                        <span>{t('settings.subscription.unlimitedPlayers')}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-300">
                        <Check className="w-4 h-4 text-[#C8F135] mr-2 flex-shrink-0" />
                        <span>{t('settings.subscription.unlimitedMatchResults')}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-300">
                        <Check className="w-4 h-4 text-[#C8F135] mr-2 flex-shrink-0" />
                        <span>{t('settings.subscription.unlimitedSharing')}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-300">
                        <Check className="w-4 h-4 text-[#C8F135] mr-2 flex-shrink-0" />
                        <span>{t('settings.subscription.liveGameSharingFeature')}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleUpgradeSubscription}
                      disabled={upgradingSubscription}
                      className="w-full px-6 py-3 bg-[#C8F135] text-[#040c1a] font-bold rounded-full hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {upgradingSubscription ? t('settings.subscription.processing') : t('settings.subscription.upgradeTitle')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className={`text-lg font-bold text-white`}>{t('settings.subscription.premiumPlan')}</h4>
                    <p className={`text-sm mt-1 text-gray-400`}>{t('settings.subscription.premiumDesc')}</p>
                  </div>
                  <span className="px-3 py-1 bg-[#C8F135]/20 text-[#C8F135] text-sm font-medium rounded-full border border-[#C8F135]/30">
                    {t('settings.subscription.active')}
                  </span>
                </div>

                <div className="rounded-xl p-4 space-y-2 bg-[#C8F135]/5 border border-[#C8F135]/20">
                  <h5 className="font-semibold mb-3 text-white">{t('settings.subscription.premiumFeatures')}</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-300">
                      <Check className="w-4 h-4 text-[#C8F135] mr-2" />
                      <span>{t('settings.subscription.unlimitedPlayers')}</span>
                    </div>
                    <div className="flex items-center text-gray-300">
                      <Check className="w-4 h-4 text-[#C8F135] mr-2" />
                      <span>{t('settings.subscription.unlimitedMatchResults')}</span>
                    </div>
                    <div className="flex items-center text-gray-300">
                      <Check className="w-4 h-4 text-[#C8F135] mr-2" />
                      <span>{t('settings.subscription.unlimitedSharing')}</span>
                    </div>
                    <div className="flex items-center text-gray-300">
                      <Check className="w-4 h-4 text-[#C8F135] mr-2" />
                      <span>{t('settings.subscription.liveGameSharingEnabled')}</span>
                    </div>
                  </div>
                </div>

                <div className={`border-t pt-4 border-[#1A6FC4]/10`}>
                  <p className={`text-sm mb-3 text-gray-400`}>
                    {t('settings.subscription.billedMonthly')}
                  </p>
                  <button
                    onClick={handleCancelSubscription}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-[#C8F135] rounded-full transition-all duration-300 text-sm font-bold border border-red-600/50 hover:border-red-700/50"
                  >
                    {t('settings.subscription.cancelButton')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div id="privacy-security" className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400 scroll-mt-24">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('settings.security.title')}</h3>
            </div>
            <div className="space-y-4">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full px-6 py-3 font-bold rounded-full transition-all duration-300 hover:scale-105 text-center bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-white/20"
            >
              {t('settings.security.changePassword')}
            </button>
            </div>
          </div>
        </div>
        
        <div id="logout" className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400 scroll-mt-24">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('nav.logout')}</h3>
            </div>
            <p className={`text-sm mb-4 text-gray-400`}>
              {t('settings.logoutSection.desc')}
            </p>
            <button
              onClick={() => signOut()}
              className="w-full px-6 py-3 bg-gray-600/20 hover:bg-gray-600/30 text-gray-300 font-bold rounded-full transition-all duration-300 hover:scale-105 border border-gray-600/30"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </div>

         <div id="danger-zone" className="rounded-2xl border-2 border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-all duration-400 scroll-mt-24">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('settings.dangerZone.title')}</h3>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 mb-2">
                {t('settings.dangerZone.warningIntro')}
              </p>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                <li>{t('settings.dangerZone.item1')}</li>
                <li>{t('settings.dangerZone.item2')}</li>
                <li>{t('settings.dangerZone.item3')}</li>
                <li>{t('settings.dangerZone.item4')}</li>
                <li>{t('settings.dangerZone.item5')}</li>
              </ul>
            </div>
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full transition-all duration-300 hover:scale-105 shadow-lg shadow-red-600/20"
            >
              {t('settings.dangerZone.deleteButton')}
            </button>
            </div>
          </div>
        </div>



      <div className="flex justify-end space-x-4 mt-6">
        <button className="px-8 py-3 border-2 border-white/20 font-bold rounded-full transition-all duration-300 hover:scale-105 text-gray-300 hover:bg-white/10 hover:border-white/30">
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSaveChanges}
          disabled={saving}
          className="px-8 py-3 bg-[#C8F135] text-[#040c1a] font-bold rounded-full hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {saving ? t('settings.footer.saving') : t('settings.footer.saveButton')}
        </button>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a1628] border border-[#1A6FC4]/30 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">{t('settings.security.changePassword')}</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordError('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('settings.modals.changePassword.currentPassword')}
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 border border-[#1A6FC4]/30 bg-[#0d1a2d] text-white rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-transparent outline-none transition"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('settings.modals.changePassword.newPassword')}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 border border-[#1A6FC4]/30 bg-[#0d1a2d] text-white rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-transparent outline-none transition"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('settings.modals.changePassword.confirmNewPassword')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 border border-[#1A6FC4]/30 bg-[#0d1a2d] text-white rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-transparent outline-none transition"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {passwordError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError('');
                  }}
                  className="flex-1 px-6 py-3 border-2 border-white/20 bg-transparent text-gray-300 rounded-full font-bold hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="flex-1 px-6 py-3 bg-[#C8F135] text-[#040c1a] rounded-full font-bold hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {changingPassword ? t('settings.modals.changePassword.updating') : t('settings.modals.changePassword.updateButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a1628] border border-[#1A6FC4]/30 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-red-600">{t('settings.modals.deleteAccount.title')}</h3>
              <button
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setDeleteConfirmText('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-semibold mb-2">
                  {t('settings.modals.deleteAccount.permanentWarning')}
                </p>
                <p className="text-sm text-red-700">
                  {t('settings.modals.deleteAccount.dataWarning')}
                </p>
              </div>

              <p className="text-sm text-gray-300 mb-4">
                {t('settings.modals.deleteAccount.confirmPrompt')}
              </p>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-2 border border-[#1A6FC4]/30 bg-[#0d1a2d] text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                placeholder={t('settings.modals.deleteAccount.placeholder')}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 px-6 py-3 border-2 border-white/20 bg-transparent text-gray-300 rounded-full font-bold hover:bg-white/10 hover:border-white/30 transition-all duration-300"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmText !== 'DELETE'}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all duration-300 hover:scale-105 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {deletingAccount ? t('common.deleting') : t('settings.modals.deleteAccount.deleteButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeletePlayerModal && playerToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0a1628] border border-[#1A6FC4]/30 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">{t('settings.modals.deletePlayer.title')}</h3>
              <button
                onClick={() => {
                  setShowDeletePlayerModal(false);
                  setPlayerToDelete(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={deletingPlayer}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-300 mb-4">
                {t('settings.modals.deletePlayer.confirmPrompt').replace('{name}', `${playerToDelete.first_name} ${playerToDelete.last_name}`)}
              </p>

              <div className="space-y-3 mb-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{t('settings.modals.deletePlayer.option1Title')}</h4>
                  <p className="text-sm text-gray-600">
                    {t('settings.modals.deletePlayer.option1Desc')}
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{t('settings.modals.deletePlayer.option2Title')}</h4>
                  <p className="text-sm text-gray-600">
                    {t('settings.modals.deletePlayer.option2Desc')}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDeletePlayerOnly}
                  className="w-full px-6 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-bold rounded-full transition-all duration-300 hover:scale-105 border border-yellow-400/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  disabled={deletingPlayer}
                >
                  {deletingPlayer ? t('common.deleting') : t('settings.modals.deletePlayer.deleteOnlyButton')}
                </button>
                <button
                  onClick={handleDeletePlayerAndResults}
                  className="w-full px-6 py-3 bg-red-600 text-white font-bold rounded-full hover:bg-red-700 transition-all duration-300 hover:scale-105 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  disabled={deletingPlayer}
                >
                  {deletingPlayer ? t('common.deleting') : t('settings.modals.deletePlayer.deleteWithResultsButton')}
                </button>
                <button
                  onClick={() => {
                    setShowDeletePlayerModal(false);
                    setPlayerToDelete(null);
                  }}
                  className="w-full px-6 py-3 border-2 border-white/20 bg-transparent text-gray-300 font-bold rounded-full hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                  disabled={deletingPlayer}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ImportPlayerSelectionModal
        isOpen={isTenupImportModalOpen}
        onClose={() => setIsTenupImportModalOpen(false)}
        onSelectPlayer={handleTenupPlayerSelected}
      />
    </div>
    </>
  );
}
