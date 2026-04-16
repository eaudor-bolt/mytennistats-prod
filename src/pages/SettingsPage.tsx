import { Bell, Globe, User, Mail, Shield, Users, Plus, CreditCard as Edit2, Trash2, Eye, EyeOff, X, CreditCard, Check, Sparkles, Download, LogOut, Database, Share2, ExternalLink } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase, UserPlayer } from '../lib/supabase';
import { usePlayers } from '../contexts/PlayersContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { runClubImport } from '../utils/importClubsDetailed';
import { importTournamentsFromJson } from '../utils/importTournamentsFromJson';
import { importMatchResults } from '../utils/importMatchResults';
import { importTenupMatchResults } from '../utils/importTenupMatchResults';
import { ImportPlayerSelectionModal } from '../components/ImportPlayerSelectionModal';
import { useAlert } from '../hooks/useAlert';

type PlayerFormData = {
  first_name: string;
  last_name: string;
  license_number: string;
  birth_year: string;
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [showDeletePlayerModal, setShowDeletePlayerModal] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<UserPlayer | null>(null);
  const [deletingPlayer, setDeletingPlayer] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [importingDetailedClubs, setImportingDetailedClubs] = useState(false);
  const [detailedClubImportResult, setDetailedClubImportResult] = useState<string>('');
  const [importingTournaments, setImportingTournaments] = useState(false);
  const [tournamentImportResult, setTournamentImportResult] = useState<string>('');
  const [isMatchImportModalOpen, setIsMatchImportModalOpen] = useState(false);
  const [isTenupImportModalOpen, setIsTenupImportModalOpen] = useState(false);
  const [pendingJsonData, setPendingJsonData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sharedLinks, setSharedLinks] = useState<Array<{
    id: string;
    type: 'Live Score' | 'Match Result';
    url: string;
    created_at: string;
    player_names?: string[];
  }>>([]);
  const [loadingSharedLinks, setLoadingSharedLinks] = useState(false);

  useEffect(() => {
    loadUserData();
    loadSettings();
    handleReturnFromStripe();
    loadSharedLinks();
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

        await ensureDefaultPlayer(user.id, profile.first_name, profile.last_name, profile.birth_year);
      } else {
        const authFirstName = user.user_metadata?.first_name || '';
        const authLastName = user.user_metadata?.last_name || '';
        setFirstName(authFirstName);
        setLastName(authLastName);
      }
    }
  };

  const ensureDefaultPlayer = async (userId: string, firstName: string | null, lastName: string | null, birthYear: number | null) => {
    const { data: existingPlayers } = await supabase
      .from('user_players')
      .select('id')
      .eq('user_id', userId);

    if (!existingPlayers || existingPlayers.length === 0) {
      const playerFirstName = firstName || 'Player';
      const playerLastName = lastName || '';
      const playerBirthYear = birthYear || new Date().getFullYear() - 30;

      await supabase
        .from('user_players')
        .insert({
          user_id: userId,
          first_name: playerFirstName,
          last_name: playerLastName,
          birth_year: playerBirthYear,
          license_number: '',
        });

      await refreshPlayers();
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

      showAlert('Welcome to Premium! Your subscription is now active.', { type: 'success' });
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
      showAlert('Error saving settings', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!playerForm.first_name || !playerForm.birth_year) {
      showAlert('Please fill in at least first name and birth year', { type: 'warning' });
      return;
    }

    if (!canCreatePlayer) {
      showAlert(`You've reached the limit of ${limits.maxPlayers} player(s) on the Free plan. Upgrade to Premium for unlimited players!`, { type: 'warning' });
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
      showAlert('Error adding player', { type: 'error' });
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
      showAlert('Error updating player', { type: 'error' });
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
        showAlert('Error deleting player', { type: 'error' });
        return;
      }

      await refreshPlayers();
      showAlert('Player deleted successfully', { type: 'success' });
      setShowDeletePlayerModal(false);
      setPlayerToDelete(null);
    } catch (error) {
      console.error('Error:', error);
      showAlert('Error deleting player');
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
        showAlert('Error deleting player', { type: 'error' });
        return;
      }

      await refreshPlayers();
      showAlert('Player and all match results deleted successfully', { type: 'success' });
      setShowDeletePlayerModal(false);
      setPlayerToDelete(null);
    } catch (error) {
      console.error('Error:', error);
      showAlert('Error deleting player and results', { type: 'error' });
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

  const handleImportFromUrl = async () => {
    if (!importUrl) {
      showAlert('Please enter a URL', { type: 'warning' });
      return;
    }

    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showAlert('You must be logged in to import players', { type: 'warning' });
        return;
      }

      const shareIdMatch = importUrl.match(/\/match-history\/([a-f0-9-]+)/);
      const sharedResultsMatch = importUrl.match(/\/shared-results\/([a-f0-9-]+)/);

      if (shareIdMatch) {
        const matchId = shareIdMatch[1];
        const { data: matchData, error: matchError } = await supabase
          .from('match_results')
          .select('*')
          .eq('id', matchId)
          .maybeSingle();

        if (matchError || !matchData) {
          showAlert('Could not load match data from URL', { type: 'error' });
          return;
        }

        const existingPlayer = players.find(p =>
          p.first_name === matchData.player_name.split(' ')[0]
        );

        let playerId = existingPlayer?.id;

        if (!existingPlayer) {
          const nameParts = matchData.player_name.split(' ');
          const firstName = nameParts[0] || 'Player';
          const lastName = nameParts.slice(1).join(' ') || '';

          const { data: newPlayer, error: playerError } = await supabase
            .from('user_players')
            .insert({
              user_id: user.id,
              first_name: firstName,
              last_name: lastName,
              birth_year: new Date().getFullYear() - 30,
              license_number: '',
            })
            .select()
            .single();

          if (playerError || !newPlayer) {
            showAlert('Error creating player', { type: 'error' });
            return;
          }

          playerId = newPlayer.id;
          await incrementUsage('player');
        }

        const { error: insertError } = await supabase
          .from('match_results')
          .insert({
            user_id: user.id,
            date: matchData.date,
            player_name: matchData.player_name,
            tournament_name: matchData.tournament_name,
            score: matchData.score,
            classement: matchData.classement,
            impressions: matchData.impressions,
            scoring_history: matchData.scoring_history,
            event_details: matchData.event_details,
            comments: matchData.comments,
          });

        if (insertError) {
          showAlert('Error importing match result', { type: 'error' });
          return;
        }

        await refreshPlayers();
        showAlert('Player and match imported successfully!', { type: 'success' });
        setShowImportModal(false);
        setImportUrl('');

      } else if (sharedResultsMatch) {
        const shareId = sharedResultsMatch[1];
        const { data: shareData, error: shareError } = await supabase
          .from('shared_match_results')
          .select('*')
          .eq('id', shareId)
          .eq('is_active', true)
          .maybeSingle();

        if (shareError || !shareData) {
          showAlert('Could not load shared results from URL', { type: 'error' });
          return;
        }

        const { data: matchesData, error: matchesError } = await supabase
          .from('match_results')
          .select('*')
          .in('id', shareData.match_results_ids);

        if (matchesError || !matchesData || matchesData.length === 0) {
          showAlert('Could not load match results', { type: 'error' });
          return;
        }

        const firstMatch = matchesData[0];
        const nameParts = firstMatch.player_name.split(' ');
        const firstName = nameParts[0] || 'Player';
        const lastName = nameParts.slice(1).join(' ') || '';

        const existingPlayer = players.find(p =>
          p.first_name === firstName && p.last_name === lastName
        );

        let playerId = existingPlayer?.id;

        if (!existingPlayer) {
          const { data: newPlayer, error: playerError } = await supabase
            .from('user_players')
            .insert({
              user_id: user.id,
              first_name: firstName,
              last_name: lastName,
              birth_year: new Date().getFullYear() - 30,
              license_number: '',
            })
            .select()
            .single();

          if (playerError || !newPlayer) {
            showAlert('Error creating player', { type: 'error' });
            return;
          }

          playerId = newPlayer.id;
          await incrementUsage('player');
        }

        let successCount = 0;
        for (const match of matchesData) {
          const { error: insertError } = await supabase
            .from('match_results')
            .insert({
              user_id: user.id,
              date: match.date,
              player_name: match.player_name,
              tournament_name: match.tournament_name,
              score: match.score,
              classement: match.classement,
              impressions: match.impressions,
              scoring_history: match.scoring_history,
              event_details: match.event_details,
              comments: match.comments,
            });

          if (!insertError) {
            successCount++;
          }
        }

        await refreshPlayers();
        showAlert(`Player and ${successCount} match results imported successfully!`, { type: 'success' });
        setShowImportModal(false);
        setImportUrl('');
      } else {
        showAlert('Invalid URL. Please provide a match-history or shared-results URL.', { type: 'warning' });
      }
    } catch (error) {
      console.error('Error importing:', error);
      showAlert('Error importing data', { type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
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
        showAlert('Password updated successfully!', { type: 'success' });
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      setPasswordError('Error updating password');
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
        showAlert('Error creating checkout session: ' + error, { type: 'error' });
      } else if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      showAlert('Error upgrading subscription', { type: 'error' });
    } finally {
      setUpgradingSubscription(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features.')) {
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
        showAlert('Error cancelling subscription: ' + result.error, { type: 'error' });
      } else {
        showAlert('Subscription cancelled successfully', { type: 'success' });
        window.location.reload();
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      showAlert('Error cancelling subscription', { type: 'error' });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showAlert('Please type DELETE to confirm account deletion', { type: 'warning' });
      return;
    }

    setDeletingAccount(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc('delete_user_account', { p_user_id: user.id });
      await supabase.auth.signOut();

      showAlert('Your account has been permanently deleted.', { type: 'success' });
      window.location.href = '/';
    } catch (error) {
      console.error('Error deleting account:', error);
      showAlert('Error deleting account. Please contact support.', { type: 'error' });
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleImportDetailedClubs = async () => {
    setImportingDetailedClubs(true);
    setDetailedClubImportResult('');

    try {
      console.log('Starting detailed club import with multiple installations...');
      const result = await runClubImport();

      if (result.success) {
        const message = `Import complete! ${result.newClubsCount} new clubs, ${result.updatedClubsCount} updated. ${result.errorCount > 0 ? `${result.errorCount} errors occurred.` : ''}`;
        setDetailedClubImportResult(message);
        showAlert(message + (result.errors ? `\n\nErrors:\n${result.errors.join('\n')}` : ''), { type: 'success' });
      } else {
        const errorMsg = `Import failed: ${result.message}\n\nCheck browser console for details (F12)`;
        setDetailedClubImportResult(errorMsg);
        showAlert(errorMsg, { type: 'error' });
      }
    } catch (error) {
      console.error('Error importing detailed clubs:', error);
      const errorMsg = `Error importing detailed clubs: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck browser console for full details (F12)`;
      setDetailedClubImportResult(errorMsg);
      showAlert(errorMsg, { type: 'error' });
    } finally {
      setImportingDetailedClubs(false);
    }
  };

  const handleImportTournaments = async () => {
    setImportingTournaments(true);
    setTournamentImportResult('');

    try {
      console.log('Opening browser console to view detailed logs...');
      const result = await importTournamentsFromJson();

      if (result.success) {
        const message = `Import complete!\n${result.imported} tournaments imported\n${result.updated} tournaments updated\n${result.skipped} tournaments skipped`;
        setTournamentImportResult(message);
        showAlert(message, { type: 'success' });
      } else {
        const errorMsg = `Import failed: ${result.error || 'Unknown error'}\n\nCheck browser console for details (F12)`;
        setTournamentImportResult(errorMsg);
        showAlert(errorMsg, { type: 'error' });
      }
    } catch (error) {
      console.error('Error importing tournaments:', error);
      const errorMsg = `Error importing tournaments: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck browser console for full details (F12)`;
      setTournamentImportResult(errorMsg);
      showAlert(errorMsg, { type: 'error' });
    } finally {
      setImportingTournaments(false);
    }
  };

  const handleMatchImportClick = () => {
    setIsMatchImportModalOpen(true);
  };

  const handleTenupImportClick = () => {
    setIsTenupImportModalOpen(true);
  };

  const handleMatchPlayerSelected = (playerId: string, playerName: string) => {
    fileInputRef.current?.click();
    setPendingJsonData({ playerId, playerName });
  };

  const handleTenupPlayerSelected = async (playerId: string, playerName: string) => {
    try {
      const result = await importTenupMatchResults(playerId, playerName);
      if (result) {
        showAlert(`Import TenUp terminé! ${result.successCount} matches importés, ${result.duplicateCount} doublons ignorés, ${result.errorCount} erreurs.`, { type: 'success' });
      }
    } catch (error) {
      console.error('Error importing TenUp data:', error);
      showAlert('Erreur lors de l\'importation des données TenUp.', { type: 'error' });
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      if (pendingJsonData) {
        const result = await importMatchResults(jsonData, pendingJsonData.playerId, pendingJsonData.playerName);
        if (result) {
          showAlert(`Import terminé! ${result.successCount} matches importés, ${result.errorCount} erreurs.`, { type: 'success' });
        }
        setPendingJsonData(null);
      }
    } catch (error) {
      console.error('Error parsing JSON file:', error);
      showAlert('Error reading JSON file. Please make sure it is a valid JSON file.', { type: 'error' });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
        type: 'Live Score' | 'Match Result';
        url: string;
        created_at: string;
        player_names?: string[];
      }> = [];

      const { data: liveMatches, error: liveError } = await supabase
        .from('live_matches')
        .select('id, player_name, created_at, user_id')
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
              url: `${window.location.origin}/live/${match.id}`,
              created_at: match.created_at,
              player_names: [match.player_name]
            });
          });
        }
      }

      const { data: sharedResults, error: sharedError } = await supabase
        .from('shared_match_results')
        .select('id, player_names, created_at, user_id')
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
              player_names: result.player_names || []
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

  const deleteSharedLink = async (id: string, type: 'Live Score' | 'Match Result') => {
    showAlert('Are you sure you want to delete this shared link? This action cannot be undone.', {
      type: 'warning',
      title: 'Delete Shared Link',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const tableName = type === 'Live Score' ? 'live_matches' : 'shared_match_results';

          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', id);

          if (error) throw error;

          setSharedLinks(prev => prev.filter(link => link.id !== id));
          showAlert('Shared link deleted successfully', { type: 'success' });
        } catch (error) {
          console.error('Error deleting shared link:', error);
          showAlert('Error deleting shared link', { type: 'error' });
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
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Subscription Plan</h3>
            </div>
            {subscription?.subscription_tier === 'free' ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className={`text-lg font-bold text-white`}>Free Plan</h4>
                    <p className={`text-sm mt-1 text-gray-400`}>Basic features for casual players</p>
                  </div>
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-white/5 text-gray-400 border border-white/10">
                    Current Plan
                  </span>
                </div>

                <div className="rounded-xl p-4 space-y-2 bg-white/2 border border-white/5">
                  <h5 className="font-semibold mb-3 text-white">Current Usage:</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Players Created:</span>
                      <span className="font-medium text-white">{usageStats?.players_created || 0} / {limits.maxPlayers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Match Results:</span>
                      <span className="font-medium text-white">{usageStats?.match_results_created || 0} / {limits.maxMatchResults}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Shares Created:</span>
                      <span className="font-medium text-white">{usageStats?.shares_created || 0} / {limits.maxShares}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Live Game Sharing:</span>
                      <span className="font-medium text-red-400">Not Available</span>
                    </div>
                    {canAccessTournaments && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tournament Access:</span>
                        <span className="font-medium text-[#C8F135]">Enabled</span>
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
                        <h4 className="text-lg font-bold mb-1 text-white">Upgrade to Premium</h4>
                        <p className="text-sm mb-3 text-gray-400">Unlock all features for just €5/month</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-300">
                        <Check className="w-4 h-4 text-[#C8F135] mr-2 flex-shrink-0" />
                        <span>Unlimited players</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-300">
                        <Check className="w-4 h-4 text-[#C8F135] mr-2 flex-shrink-0" />
                        <span>Unlimited match results</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-300">
                        <Check className="w-4 h-4 text-[#C8F135] mr-2 flex-shrink-0" />
                        <span>Unlimited sharing</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-300">
                        <Check className="w-4 h-4 text-[#C8F135] mr-2 flex-shrink-0" />
                        <span>Live game sharing</span>
                      </div>
                    </div>

                    <button
                      onClick={handleUpgradeSubscription}
                      disabled={upgradingSubscription}
                      className="w-full px-6 py-3 bg-[#C8F135] text-[#040c1a] font-bold rounded-full hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {upgradingSubscription ? 'Processing...' : 'Upgrade to Premium'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className={`text-lg font-bold text-white`}>Premium Plan</h4>
                    <p className={`text-sm mt-1 text-gray-400`}>All features unlocked</p>
                  </div>
                  <span className="px-3 py-1 bg-[#C8F135]/20 text-[#C8F135] text-sm font-medium rounded-full border border-[#C8F135]/30">
                    Active
                  </span>
                </div>

                <div className="rounded-xl p-4 space-y-2 bg-[#C8F135]/5 border border-[#C8F135]/20">
                  <h5 className="font-semibold mb-3 text-white">Premium Features:</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-300">
                      <Check className="w-4 h-4 text-[#C8F135] mr-2" />
                      <span>Unlimited players</span>
                    </div>
                    <div className="flex items-center text-gray-300">
                      <Check className="w-4 h-4 text-[#C8F135] mr-2" />
                      <span>Unlimited match results</span>
                    </div>
                    <div className="flex items-center text-gray-300">
                      <Check className="w-4 h-4 text-[#C8F135] mr-2" />
                      <span>Unlimited sharing</span>
                    </div>
                    <div className="flex items-center text-gray-300">
                      <Check className="w-4 h-4 text-[#C8F135] mr-2" />
                      <span>Live game sharing enabled</span>
                    </div>
                  </div>
                </div>

                <div className={`border-t pt-4 border-[#1A6FC4]/10`}>
                  <p className={`text-sm mb-3 text-gray-400`}>
                    Billed at €5.00 per month
                  </p>
                  <button
                    onClick={handleCancelSubscription}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-[#C8F135] rounded-full transition-all duration-300 text-sm font-bold border border-red-600/50 hover:border-red-700/50"
                  >
                    Cancel Subscription
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <User className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Profile Information</h3>
            </div>
            <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-400">
                First Name
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
                Last Name
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
                Birth Year
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
                Email Address
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
        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Players</h3>
            </div>
            <div className="space-y-4">
            {players.map((player) => (
              <div key={player.id}>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                  <div>
                    <p className={`font-medium text-white`}>{player.first_name} {player.last_name}</p>
                    <p className={`text-sm text-gray-400`}>Birth Year: {player.birth_year}</p>
                    {player.license_number && (
                      <p className="text-sm text-gray-500">License: {player.license_number}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEditPlayer(player)}
                      className="p-2 text-[#C8F135] hover:bg-[#C8F135]/10 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePlayer(player)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {editingPlayer?.id === player.id && (
                  <div className="mt-3 p-4 border-2 rounded-xl border-[#C8F135]/30 bg-[#C8F135]/5">
                    <h4 className={`font-semibold mb-3 text-white`}>Edit Player</h4>
                    <div className="space-y-3">
                      <div>
                        <label className={`block text-sm font-medium mb-1 text-gray-300`}>First Name *</label>
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
                        <label className={`block text-sm font-medium mb-1 text-gray-300`}>Last Name</label>
                        <input
                          type="text"
                          value={playerForm.last_name}
                          onChange={(e) => setPlayerForm({ ...playerForm, last_name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                          placeholder="Last name"
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-1 text-gray-300`}>License Number</label>
                        <input
                          type="text"
                          value={playerForm.license_number}
                          onChange={(e) => setPlayerForm({ ...playerForm, license_number: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                          placeholder="FFT License"
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-1 text-gray-300`}>Birth Year *</label>
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
                          Update
                        </button>
                        <button
                          onClick={() => {
                            setEditingPlayer(null);
                            setPlayerForm({ first_name: '', last_name: '', license_number: '', birth_year: '' });
                          }}
                          className="px-6 py-3 border-2 border-white/20 text-gray-300 font-bold rounded-full hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {showAddPlayer && !editingPlayer && (
              <div className="p-4 border-2 rounded-xl border-[#C8F135]/30 bg-[#C8F135]/5">
                <h4 className={`font-semibold mb-3 text-white`}>Add New Player</h4>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 text-gray-300`}>First Name *</label>
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
                    <label className={`block text-sm font-medium mb-1 text-gray-300`}>Last Name</label>
                    <input
                      type="text"
                      value={playerForm.last_name}
                      onChange={(e) => setPlayerForm({ ...playerForm, last_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                      placeholder="Last name"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 text-gray-300`}>License Number</label>
                    <input
                      type="text"
                      value={playerForm.license_number}
                      onChange={(e) => setPlayerForm({ ...playerForm, license_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#C8F135] focus:border-[#C8F135] outline-none bg-white/5 border-white/10 text-white hover:border-white/20 transition-all"
                      placeholder="FFT License"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 text-gray-300`}>Birth Year *</label>
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
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddPlayer(false);
                        setPlayerForm({ first_name: '', last_name: '', license_number: '', birth_year: '' });
                      }}
                      className="px-6 py-3 border-2 border-white/20 text-gray-300 font-bold rounded-full hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                    >
                      Cancel
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
                      showAlert(`You've reached the limit of ${limits.maxPlayers} player(s) on the Free plan. Upgrade to Premium for unlimited players!`, { type: 'warning' });
                    } else {
                      setShowAddPlayer(true);
                    }
                  }}
                  className="w-full px-6 py-3 bg-[#C8F135]/20 hover:bg-[#C8F135]/30 text-[#C8F135] font-bold rounded-full transition-all duration-300 hover:scale-105 border border-[#C8F135]/30 flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add New Player
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="w-full px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold rounded-full transition-all duration-300 hover:scale-105 border border-blue-400/30 flex items-center justify-center"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Import Player from URL
                </button>
              </div>
            )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Notifications</h3>
            </div>
            <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-medium text-white`}>Push Notifications</p>
                <p className={`text-sm text-gray-400`}>Receive notifications about matches and tournaments</p>
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
                  <span className="ml-2 text-sm text-gray-300">Match start notifications</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" defaultChecked className="rounded text-green-600 focus:ring-green-500" />
                  <span className="ml-2 text-sm text-gray-300">Tournament updates</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="rounded text-green-600 focus:ring-green-500" />
                  <span className="ml-2 text-sm text-gray-300">Player news</span>
                </label>
              </div>
            </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Language & Region</h3>
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

        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Data Import</h3>
            </div>
            <div className="space-y-6">
            <div>
              <h4 className={`font-semibold mb-2 text-white`}>Import Detailed Clubs (Multiple Installations)</h4>
              <p className={`text-sm mb-4 text-gray-400`}>
                Import detailed club data from code/club/import-club.json. Creates separate rows for each installation.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 mb-2"><strong>How it works:</strong></p>
                <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                  <li>Each club installation becomes a separate row in the database</li>
                  <li>All installations share the same club_id</li>
                  <li>Includes detailed info: teams, installations, contact details</li>
                  <li>Check browser console (F12) for detailed progress</li>
                </ul>
              </div>
              {detailedClubImportResult && (
                <div className={`mb-4 p-3 rounded-lg text-sm max-h-48 overflow-y-auto ${
                  detailedClubImportResult.includes('failed') || detailedClubImportResult.includes('Error')
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  <pre className="whitespace-pre-wrap font-mono text-xs">{detailedClubImportResult}</pre>
                </div>
              )}
              <button
                onClick={handleImportDetailedClubs}
                disabled={importingDetailedClubs}
                className="w-full px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-bold rounded-full transition-all duration-300 hover:scale-105 border border-purple-400/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {importingDetailedClubs ? 'Importing Detailed Clubs...' : 'Import Detailed Clubs from JSON'}
              </button>
            </div>

            <div className={`border-t pt-6 ${false ? 'border-gray-700' : 'border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 text-white`}>Import Tournaments</h4>
              <p className={`text-sm mb-4 text-gray-400`}>
                Import tournaments from src/data/tournaments.json. Existing tournaments will be updated, new ones will be added.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 mb-2"><strong>How to view detailed logs:</strong></p>
                <ol className="text-sm text-red-700 list-decimal list-inside space-y-1">
                  <li>Open browser console: Press F12 (or Cmd+Option+I on Mac)</li>
                  <li>Click on the "Console" tab</li>
                  <li>Click "Import Tournaments from JSON" button below</li>
                  <li>All import progress and errors will be displayed in the console</li>
                </ol>
              </div>
              {tournamentImportResult && (
                <div className={`mb-4 p-3 rounded-lg text-sm max-h-48 overflow-y-auto ${
                  tournamentImportResult.includes('failed') || tournamentImportResult.includes('Error')
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  <pre className="whitespace-pre-wrap font-mono text-xs">{tournamentImportResult}</pre>
                </div>
              )}
              <button
                onClick={handleImportTournaments}
                disabled={importingTournaments}
                className="w-full px-6 py-3 bg-[#C8F135] text-[#040c1a] font-bold rounded-full hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {importingTournaments ? 'Importing Tournaments...' : 'Import Tournaments from JSON'}
              </button>
            </div>

            <div className={`border-t pt-6 ${false ? 'border-gray-700' : 'border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 text-white`}>Import Match Results</h4>
              <p className={`text-sm mb-4 text-gray-400`}>
                Import match results from a JSON file. Select a player and upload the match data.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={handleMatchImportClick}
                className="w-full px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold rounded-full transition-all duration-300 hover:scale-105 border border-blue-400/30"
              >
                Import Match Results
              </button>
            </div>

            <div className={`border-t pt-6 ${false ? 'border-gray-700' : 'border-gray-200'}`}>
              <h4 className={`font-semibold mb-2 text-white`}>Import Match Results from TenUp</h4>
              <p className={`text-sm mb-4 text-gray-400`}>
                Import match results from TenUp. Select a player to import their match history.
              </p>
              <button
                onClick={handleTenupImportClick}
                className="w-full px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-bold rounded-full transition-all duration-300 hover:scale-105 border border-purple-400/30"
              >
                Import from TenUp
              </button>
            </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Shared Links</h3>
            </div>
            <p className={`text-sm mb-4 text-gray-400`}>
              Manage all your shared links for live scores and match results.
            </p>

            {loadingSharedLinks ? (
              <div className="text-center py-8">
                <p className={false ? 'text-gray-400' : 'text-gray-600'}>Loading shared links...</p>
              </div>
            ) : sharedLinks.length === 0 ? (
              <div className="text-center py-8">
                <p className={false ? 'text-gray-400' : 'text-gray-600'}>No shared links yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${false ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-2 text-sm font-semibold text-gray-300`}>Type</th>
                      <th className={`text-left py-3 px-2 text-sm font-semibold text-gray-300`}>Players</th>
                      <th className={`text-left py-3 px-2 text-sm font-semibold text-gray-300`}>Created</th>
                      <th className={`text-left py-3 px-2 text-sm font-semibold text-gray-300`}>URL</th>
                      <th className={`text-center py-3 px-2 text-sm font-semibold text-gray-300`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sharedLinks.map((link) => (
                      <tr key={link.id} className={`border-b ${false ? 'border-gray-800' : 'border-gray-100'}`}>
                        <td className="py-3 px-2">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            link.type === 'Live Score'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {link.type}
                          </span>
                        </td>
                        <td className={`py-3 px-2 text-sm text-gray-300`}>
                          {link.player_names && link.player_names.length > 0 ? link.player_names.join(', ') : '-'}
                        </td>
                        <td className={`py-3 px-2 text-sm text-gray-400`}>
                          {new Date(link.created_at).toLocaleDateString()}
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
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={async () => {
                                await navigator.clipboard.writeText(link.url);
                                showAlert('Lien copié dans le presse-papiers! Partagez-le pour montrer les résultats.', {
                                  type: 'success',
                                  title: 'Partage créé',
                                  link: link.url
                                });
                              }}
                              className="p-1 text-[#C8F135] hover:bg-[#C8F135]/10 rounded transition-colors"
                              title="Copy link"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteSharedLink(link.id, link.type)}
                              className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
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

        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Privacy & Security</h3>
            </div>
            <div className="space-y-4">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full px-6 py-3 font-bold rounded-full transition-all duration-300 hover:scale-105 text-center bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-white/20"
            >
              Change Password
            </button>
            </div>
          </div>
        </div>

         <div className="rounded-2xl border-2 border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Danger Zone</h3>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 mb-2">
                <strong>Warning:</strong> This action cannot be undone. Deleting your account will permanently remove:
              </p>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                <li>Your profile and all personal data</li>
                <li>All registered players</li>
                <li>Match history and results</li>
                <li>Tournament registrations and convocations</li>
                <li>Subscription and payment information</li>
              </ul>
            </div>
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full transition-all duration-300 hover:scale-105 shadow-lg shadow-red-600/20"
            >
              Delete Account Permanently
            </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-[#C8F135]/25 transition-all duration-400">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#C8F135]/10 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-[#C8F135]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('nav.logout')}</h3>
            </div>
            <p className={`text-sm mb-4 text-gray-400`}>
              Sign out from your account. You can always log back in with your credentials.
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

      <div className="flex justify-end space-x-4 mt-6">
        <button className="px-8 py-3 border-2 border-white/20 font-bold rounded-full transition-all duration-300 hover:scale-105 text-gray-300 hover:bg-white/10 hover:border-white/30">
          Cancel
        </button>
        <button
          onClick={handleSaveChanges}
          disabled={saving}
          className="px-8 py-3 bg-[#C8F135] text-[#040c1a] font-bold rounded-full hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a1628] border border-[#1A6FC4]/30 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Change Password</h3>
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
                  Current Password
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
                  New Password
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
                  Confirm New Password
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
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="flex-1 px-6 py-3 bg-[#C8F135] text-[#040c1a] rounded-full font-bold hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {changingPassword ? 'Updating...' : 'Update Password'}
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
              <h3 className="text-xl font-bold text-red-600">Delete Account</h3>
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
                  This action is permanent and cannot be undone!
                </p>
                <p className="text-sm text-red-700">
                  All your data will be permanently deleted from our servers.
                </p>
              </div>

              <p className="text-sm text-gray-300 mb-4">
                To confirm, please type <strong className="text-red-600">DELETE</strong> below:
              </p>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-2 border border-[#1A6FC4]/30 bg-[#0d1a2d] text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                placeholder="Type DELETE"
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
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmText !== 'DELETE'}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all duration-300 hover:scale-105 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {deletingAccount ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0a1628] border border-[#1A6FC4]/30 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Import Player from URL</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportUrl('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Paste a match-history URL or shared-results URL to import the player and their match results.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://tennis-tournament-or-06an.bolt.host/match-history/..."
                  className="w-full px-3 py-2 border border-[#1A6FC4]/30 bg-[#0d1a2d] text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  disabled={importing}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> This will create a new player (if not exists) and import all match results from the provided URL.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportUrl('');
                  }}
                  className="flex-1 px-6 py-3 border-2 border-white/20 bg-transparent text-gray-300 font-bold rounded-full hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                  disabled={importing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportFromUrl}
                  className="flex-1 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold rounded-full transition-all duration-300 hover:scale-105 border border-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  disabled={importing || !importUrl}
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeletePlayerModal && playerToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0a1628] border border-[#1A6FC4]/30 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Delete Player</h3>
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
                You are about to delete <strong>{playerToDelete.first_name} {playerToDelete.last_name}</strong>.
                Please choose an option:
              </p>

              <div className="space-y-3 mb-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Option 1: Delete Player Only</h4>
                  <p className="text-sm text-gray-600">
                    Remove the player from your players list. All match results will remain in your account.
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Option 2: Delete Player + Results</h4>
                  <p className="text-sm text-gray-600">
                    Remove the player AND permanently delete all their match results. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDeletePlayerOnly}
                  className="w-full px-6 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-bold rounded-full transition-all duration-300 hover:scale-105 border border-yellow-400/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  disabled={deletingPlayer}
                >
                  {deletingPlayer ? 'Deleting...' : 'Delete Player Only'}
                </button>
                <button
                  onClick={handleDeletePlayerAndResults}
                  className="w-full px-6 py-3 bg-red-600 text-white font-bold rounded-full hover:bg-red-700 transition-all duration-300 hover:scale-105 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  disabled={deletingPlayer}
                >
                  {deletingPlayer ? 'Deleting...' : 'Delete Player + All Results'}
                </button>
                <button
                  onClick={() => {
                    setShowDeletePlayerModal(false);
                    setPlayerToDelete(null);
                  }}
                  className="w-full px-6 py-3 border-2 border-white/20 bg-transparent text-gray-300 font-bold rounded-full hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                  disabled={deletingPlayer}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ImportPlayerSelectionModal
        isOpen={isMatchImportModalOpen}
        onClose={() => setIsMatchImportModalOpen(false)}
        onSelectPlayer={handleMatchPlayerSelected}
      />

      <ImportPlayerSelectionModal
        isOpen={isTenupImportModalOpen}
        onClose={() => setIsTenupImportModalOpen(false)}
        onSelectPlayer={handleTenupPlayerSelected}
      />
    </div>
    </>
  );
}
