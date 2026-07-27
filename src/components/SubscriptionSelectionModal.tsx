import { X, Check, Sparkles } from 'lucide-react';

type SubscriptionSelectionModalProps = {
  onSelectFree: () => void;
  onSelectPremium: () => void;
  onClose: () => void;
};

export function SubscriptionSelectionModal({
  onSelectFree,
  onSelectPremium,
  onClose,
}: SubscriptionSelectionModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#0a1628] border border-white/10 rounded-2xl shadow-2xl max-w-4xl w-full p-4 sm:p-6 md:p-8 my-8">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Choose Your Plan</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 text-white"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6 hover:border-[#C8F135]/30 transition-all">
            <div className="text-center mb-4 sm:mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Free</h3>
              <p className="text-3xl sm:text-4xl font-bold text-white">€0<span className="text-base sm:text-lg text-gray-400">/month</span></p>
            </div>

            <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-300">1 extra player profile max</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-300">Live score match available once</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-300">Recording of 3 points max during Live scoring</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-300">Upload 3 videos max (max 1 minute per video)</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-300">Get 3 responses max to explain rules</span>
              </li>
            </ul>

            <button
              onClick={onSelectFree}
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 border border-white/20 text-white text-sm sm:text-base font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              Start with Free
            </button>
          </div>

          <div className="relative bg-white/5 backdrop-blur-sm border-2 border-[#C8F135] rounded-xl p-4 sm:p-6 shadow-lg shadow-[#C8F135]/20 hover:shadow-[#C8F135]/30 transition-all">
            <div className="absolute -top-3 right-4 sm:right-6 bg-[#C8F135] text-[#050d1a] px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold">
              Popular
            </div>

            <div className="text-center mb-4 sm:mb-6">
              <div className="flex items-center justify-center mb-2">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#C8F135] mr-2" />
                <h3 className="text-xl sm:text-2xl font-bold text-white">Premium</h3>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-[#C8F135]">€5<span className="text-base sm:text-lg text-gray-400">/month</span></p>
            </div>

            <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-white font-medium">Unlimited player profiles</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-white font-medium">Live scoring with sharing</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-white font-medium">Unlimited match results sharing</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-white font-medium">Unlimited video uploads (max 1 minute per video, 1GB storage limit)</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-white font-medium">Priority support</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#C8F135] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-white font-medium">Access to beta features</span>
              </li>
            </ul>

            <button
              onClick={onSelectPremium}
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-[#C8F135] hover:bg-white text-[#050d1a] text-sm sm:text-base font-semibold rounded-lg transition-colors shadow-md"
            >
              Upgrade to Premium
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          You can upgrade or downgrade your plan anytime from your account settings.
        </p>
      </div>
    </div>
  );
}
