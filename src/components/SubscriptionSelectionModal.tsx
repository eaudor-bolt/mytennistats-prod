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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-4 sm:p-6 md:p-8 my-8">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Choose Your Plan</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="border-2 border-gray-200 rounded-xl p-4 sm:p-6 hover:border-gray-300 transition-all">
            <div className="text-center mb-4 sm:mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Free</h3>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">€0<span className="text-base sm:text-lg text-gray-600">/month</span></p>
            </div>

            <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-700">1 registered player</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-700">Up to 5 tournament registrations</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-700">Basic match tracking</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-700">View tournament calendar</span>
              </li>
            </ul>

            <button
              onClick={onSelectFree}
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-600 text-white text-sm sm:text-base font-semibold rounded-lg hover:bg-gray-700 transition-colors shadow-md"
            >
              Start with Free
            </button>
          </div>

          <div className="border-2 border-yellow-400 rounded-xl p-4 sm:p-6 relative bg-gradient-to-br from-yellow-50 to-amber-50 hover:border-yellow-500 transition-all">
            <div className="absolute -top-3 right-4 sm:right-6 bg-yellow-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold">
              Popular
            </div>

            <div className="text-center mb-4 sm:mb-6">
              <div className="flex items-center justify-center mb-2">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 mr-2" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Premium</h3>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">€5<span className="text-base sm:text-lg text-gray-600">/month</span></p>
            </div>

            <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-700 font-medium">Unlimited players</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-700 font-medium">Unlimited tournament registrations</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-700 font-medium">Unlimited match tracking</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-700 font-medium">Live match scoring</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-700 font-medium">Match video uploads</span>
              </li>
              <li className="flex items-start">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base text-gray-700 font-medium">Live game sharing</span>
              </li>
            </ul>

            <button
              onClick={onSelectPremium}
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-yellow-600 text-white text-sm sm:text-base font-semibold rounded-lg hover:bg-yellow-700 transition-colors shadow-md"
            >
              Upgrade to Premium
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          You can upgrade or downgrade your plan anytime from your account settings.
        </p>
      </div>
    </div>
  );
}
