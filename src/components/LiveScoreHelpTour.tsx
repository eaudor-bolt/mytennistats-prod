import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';

type TourStep = {
  targetId: string;
  title: string;
  body: string;
};

const STEPS: TourStep[] = [
  {
    targetId: 'tour-record-button',
    title: 'Enregistrer une vidéo du point',
    body: "Cliquez sur ce bouton juste avant de jouer le point. La vidéo s'envoie automatiquement une fois le point terminé.",
  },
  {
    targetId: 'tour-skill-row-forehand',
    title: 'Indiquer comment le point s\'est terminé',
    body: "Quand un point est fini, cliquez sur Faute ou Gagne selon le dernier coup joué. Par exemple, si le point se termine par un coup droit gagnant, cliquez sur Gagne sur la ligne Coup Droit.",
  },
  {
    targetId: 'tour-skill-row-opponent',
    title: "Faute ou point de l'adversaire",
    body: "Cette ligne fonctionne un peu différemment : elle décrit le coup de l'adversaire, pas le vôtre. Cliquez sur Faute si l'adversaire s'est trompé (le point revient à votre joueur), ou sur Gagne s'il a marqué un point gagnant — dans ce cas, c'est le score de l'adversaire qui est incrémenté.",
  },
  {
    targetId: 'tour-share-button',
    title: 'Partager le score en direct',
    body: 'Cliquez sur « Partager » pour envoyer un lien à n\'importe qui et suivre le match en direct, en temps réel.',
  },
  {
    targetId: 'tour-lock-button',
    title: 'Déverrouiller le score',
    body: 'Le score est verrouillé par défaut pour éviter les erreurs. Cliquez ici pour le déverrouiller avant de le modifier manuellement.',
  },
  {
    targetId: 'tour-undo-button',
    title: 'Annuler un point en cas d\'erreur',
    body: 'Une fois déverrouillé, si vous vous êtes trompé sur le dernier point, cliquez sur la flèche « Annuler » pour revenir en arrière et le corriger.',
  },
  {
    targetId: 'tour-score-cell',
    title: 'Changer le score manuellement',
    body: 'Une fois déverrouillé, cliquez directement sur un score affiché pour l\'ajuster à la main.',
  },
  {
    targetId: 'tour-finish-button',
    title: 'Terminer le match',
    body: 'À la fin de la rencontre, cliquez sur « Terminer le Match » pour enregistrer définitivement le score.',
  },
];

const PADDING = 8;

type Rect = { top: number; left: number; width: number; height: number } | null;

export function LiveScoreHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors"
      title="Aide"
    >
      <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" />
    </button>
  );
}

export function LiveScoreHelpTour({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect>(null);

  const recomputeTarget = useCallback(() => {
    const step = STEPS[stepIndex];
    const el = document.querySelector(`[data-tour-id="${step.targetId}"]`);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setTargetRect(null);
      return;
    }
    setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [stepIndex]);

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    recomputeTarget();

    const handle = () => recomputeTarget();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    const timeout = setTimeout(recomputeTarget, 350);

    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
      clearTimeout(timeout);
    };
  }, [isOpen, recomputeTarget]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
      else if (e.key === 'ArrowLeft') setStepIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;

  // Tooltip placement: prefer just below the target, flip above if that
  // would run off the bottom of the screen; always clamped horizontally.
  const tooltipWidth = 320;
  let tooltipTop: number;
  let tooltipLeft: number;

  if (targetRect) {
    const spaceBelow = window.innerHeight - (targetRect.top + targetRect.height);
    const placeBelow = spaceBelow > 220 || spaceBelow > targetRect.top;
    tooltipTop = placeBelow
      ? targetRect.top + targetRect.height + PADDING * 2
      : Math.max(16, targetRect.top - PADDING * 2 - 200);
    tooltipLeft = Math.min(
      Math.max(16, targetRect.left + targetRect.width / 2 - tooltipWidth / 2),
      window.innerWidth - tooltipWidth - 16
    );
  } else {
    tooltipTop = window.innerHeight / 2 - 100;
    tooltipLeft = window.innerWidth / 2 - tooltipWidth / 2;
  }

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* Dims the whole screen; swallows stray clicks so the tour stays in control. */}
      <div className="absolute inset-0 bg-black/70 transition-opacity" onClick={onClose} />

      {/* Spotlight cutout: box-shadow creates the dim everywhere except this box. */}
      {targetRect && (
        <div
          className="absolute rounded-xl border-2 border-[#C8F135] transition-all duration-300 pointer-events-none"
          style={{
            top: targetRect.top - PADDING,
            left: targetRect.left - PADDING,
            width: targetRect.width + PADDING * 2,
            height: targetRect.height + PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.7), 0 0 24px 4px rgba(200,241,53,0.5)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute bg-[#0a1628] border border-[#C8F135]/30 rounded-xl shadow-2xl p-4 transition-all duration-300"
        style={{ top: tooltipTop, left: tooltipLeft, width: tooltipWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#C8F135] uppercase tracking-wider">
            Étape {stepIndex + 1} / {STEPS.length}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" title="Fermer">
            <X size={16} />
          </button>
        </div>
        <h4 className="text-white font-bold text-sm mb-1.5">{step.title}</h4>
        <p className="text-gray-300 text-xs leading-relaxed mb-4">{step.body}</p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === stepIndex ? 'bg-[#C8F135]' : 'bg-white/20'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => setStepIndex(i => i - 1)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ChevronLeft size={14} />
                Précédent
              </button>
            )}
            <button
              onClick={() => (isLast ? onClose() : setStepIndex(i => i + 1))}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#050d1a] bg-[#C8F135] hover:bg-[#d4f855] rounded-lg transition-colors"
            >
              {isLast ? 'Terminé' : 'Suivant'}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
