import { X, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';

type AlertModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  confirmText?: string;
  link?: string;
  onConfirm?: () => void;
  cancelText?: string;
};

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  link,
  onConfirm,
  cancelText = 'Cancel'
}: AlertModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    if (link) {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenLink = () => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[#0a1526] border border-[#C8F135]/30 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
        <div className="sticky top-0 bg-[#0a1526] border-b border-[#C8F135]/20 p-6 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-white">
            {title || (type === 'error' ? 'Erreur' : type === 'success' ? 'Succès' : type === 'warning' ? 'Attention' : 'Information')}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#C8F135] hover:bg-[#d4f855] flex items-center justify-center transition text-black"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          <div className="text-gray-300 whitespace-pre-line leading-relaxed mb-4">
            {message}
          </div>

          {link && (
            <div className="mt-4 space-y-3">
              <div className="bg-[#0f1e35] border border-[#C8F135]/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-[#C8F135]">LIEN DE PARTAGE</span>
                </div>
                <div className="text-sm text-gray-400 break-all font-mono bg-black/30 p-2 rounded">
                  {link}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copié!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copier le lien
                    </>
                  )}
                </button>
                <button
                  onClick={handleOpenLink}
                  className="flex-1 px-4 py-2.5 bg-[#C8F135] hover:bg-[#d4f855] text-black rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ouvrir
                </button>
              </div>
            </div>
          )}

          {!link && onConfirm && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg font-medium transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 px-4 py-2.5 rounded-lg font-bold transition-colors ${
                  type === 'error' || type === 'warning'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-[#C8F135] hover:bg-[#d4f855] text-black'
                }`}
              >
                {confirmText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}