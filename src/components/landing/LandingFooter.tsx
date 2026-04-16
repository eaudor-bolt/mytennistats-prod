import { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLegalContent } from './legalContent';

type LegalModalType = 'terms' | 'privacy' | null;

export function LandingFooter() {
  const { t, language } = useLanguage();
  const [openModal, setOpenModal] = useState<LegalModalType>(null);
  const legalContent = getLegalContent(language);

  return (
    <>
      <footer className="bg-[#040b16] border-t border-[#1A6FC4]/15 pt-16 pb-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-4">
              <h4 className="text-white text-sm font-semibold tracking-widest uppercase">LEGAL</h4>
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setOpenModal('terms')}
                  className="text-gray-400 text-sm hover:text-[#C8F135] transition-colors duration-200"
                >
                  Terms of Service
                </button>
                <button
                  onClick={() => setOpenModal('privacy')}
                  className="text-gray-400 text-sm hover:text-[#C8F135] transition-colors duration-200"
                >
                  Privacy Policy
                </button>
              </div>
            </div>

            <a
              href="mailto:contact@mytennistats.com"
              className="text-gray-500 text-xs hover:text-[#C8F135] transition-colors duration-200"
            >
              contact@mytennistats.com
            </a>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-center gap-4">
            <p className="text-gray-600 text-xs">
              &copy; {new Date().getFullYear()} {t.footer.copyright}
            </p>
          </div>
        </div>
      </footer>

      {openModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={() => setOpenModal(null)}
        >
          <div
            className="bg-[#0a1526] border border-[#C8F135]/30 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#0a1526] border-b border-[#C8F135]/20 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-white">
                {openModal === 'terms' ? legalContent.termsOfUse.title : legalContent.privacyPolicy.title}
              </h2>
              <button
                onClick={() => setOpenModal(null)}
                className="w-10 h-10 rounded-full bg-[#C8F135] hover:bg-[#d4f855] flex items-center justify-center transition text-black"
                aria-label="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-6">
              <div className="text-gray-300 whitespace-pre-line leading-relaxed">
                {openModal === 'terms' ? legalContent.termsOfUse.content : legalContent.privacyPolicy.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
