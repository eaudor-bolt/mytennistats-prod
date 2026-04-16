import { useState, useEffect } from 'react';
import { X, MessageSquare, Send } from 'lucide-react';
import { Tournament, TournamentComment, supabase } from '../lib/supabase';
import { TournamentCard } from './TournamentCard';

type TournamentModalProps = {
  tournament: Tournament | null;
  isOpen: boolean;
  onClose: () => void;
  onRegistrationChange?: () => void;
};

export function TournamentModal({ tournament, isOpen, onClose, onRegistrationChange }: TournamentModalProps) {
  const [comments, setComments] = useState<TournamentComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    if (tournament && isOpen) {
      loadComments(tournament.id);
    }
  }, [tournament, isOpen]);

  const loadComments = async (tournamentId: string) => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('tournament_comments')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    setComments(data || []);
    setLoadingComments(false);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament || !newComment.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Vous devez être connecté pour commenter');
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();

    const authorName = profile
      ? `${profile.first_name} ${profile.last_name}`
      : 'Utilisateur';

    const { error } = await supabase
      .from('tournament_comments')
      .insert({
        tournament_id: tournament.id,
        user_id: user.id,
        author_name: authorName,
        text: newComment.trim()
      });

    if (error) {
      console.error('Error adding comment:', error);
      alert('Erreur lors de l\'ajout du commentaire');
      return;
    }

    setNewComment('');
    await loadComments(tournament.id);
  };

  if (!isOpen || !tournament) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-black border border-[#C8F135]/30 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] sm:max-h-[95vh] overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#C8F135]/20">
          <h3 className="text-lg sm:text-xl font-bold text-white m-0">Détails du Tournoi</h3>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#C8F135] hover:bg-[#d4f855] flex items-center justify-center transition text-black"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] sm:max-h-[calc(95vh-88px)] p-0">
          <div className="p-4 sm:p-6">
            <TournamentCard
              tournament={tournament}
              isSelected={false}
              onClick={() => {}}
              onRegistrationChange={onRegistrationChange}
            />

            <div className="mt-6 border-t border-[#C8F135]/20 pt-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#C8F135]" />
                Commentaires
              </h3>

              <div className="space-y-4 mb-6">
                {loadingComments ? (
                  <p className="text-gray-400 text-sm italic">Chargement...</p>
                ) : comments.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">Aucun commentaire. Soyez le premier!</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-white/5 p-3 rounded-lg border border-[#C8F135]/20">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-xs text-[#C8F135]">{comment.author_name}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <p className="text-sm text-white">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleCommentSubmit} className="relative">
                <input
                  type="text"
                  placeholder="Écrire un commentaire..."
                  className="w-full pl-4 pr-12 py-3 bg-white/10 rounded-full border border-[#C8F135]/20 focus:ring-2 focus:ring-[#C8F135] text-sm transition-all text-white placeholder-gray-400"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#C8F135] text-black rounded-full hover:bg-[#d4f855] transition-colors disabled:opacity-50"
                  disabled={!newComment.trim()}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
