import { Check } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

type LandingPricingProps = {
  onSignUp: () => void;
};

export function LandingPricing({ onSignUp }: LandingPricingProps) {
  const { t } = useLanguage();

  const freeFeatures = [
    t('landing.pricing.free.feature1'),
    t('landing.pricing.free.feature2'),
    t('landing.pricing.free.feature3'),
    t('landing.pricing.free.feature4'),
  ];

  const premiumFeatures = [
    t('landing.pricing.premium.feature1'),
    t('landing.pricing.premium.feature2'),
    t('landing.pricing.premium.feature3'),
    t('landing.pricing.premium.feature4'),
    t('landing.pricing.premium.feature5'),
    t('landing.pricing.premium.feature6'),
  ];

  return (
    <section id="pricing" className="py-24 px-4 bg-[#050d1a] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#C8F135]/3 to-transparent pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {t('landing.pricing.title')}
          </h2>
          <div className="w-16 h-1 bg-[#C8F135] mx-auto rounded-full" />
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8 flex flex-col hover:border-[#C8F135]/30 transition-all duration-300">
            <h3 className="text-xl font-bold text-white mb-1">
              {t('landing.pricing.free.title')}
            </h3>
            <p className="text-4xl font-bold text-white mb-6">
              0€
              <span className="text-base font-normal text-gray-400">
                {t('landing.pricing.free.month')}
              </span>
            </p>
            <ul className="space-y-3 mb-8 flex-1">
              {freeFeatures.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#C8F135] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300 text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={onSignUp}
              className="w-full py-3 px-6 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              {t('landing.pricing.free.cta')}
            </button>
          </div>

          <div className="relative bg-white/5 backdrop-blur-sm rounded-2xl border-2 border-[#C8F135] p-8 flex flex-col shadow-lg shadow-[#C8F135]/20 hover:shadow-[#C8F135]/30 transition-all duration-300">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#C8F135] text-[#050d1a] text-xs font-semibold rounded-full tracking-wide">
              {t('landing.pricing.premium.popular')}
            </div>
            <h3 className="text-xl font-bold text-white mb-1">
              {t('landing.pricing.premium.title')}
            </h3>
            <p className="text-4xl font-bold text-[#C8F135] mb-6">
              5€
              <span className="text-base font-normal text-gray-400">
                {t('landing.pricing.free.month')}
              </span>
            </p>
            <ul className="space-y-3 mb-8 flex-1">
              {premiumFeatures.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#C8F135] flex-shrink-0 mt-0.5" />
                  <span className="text-white text-sm font-medium">{feature}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={onSignUp}
              className="w-full py-3 px-6 bg-[#C8F135] hover:bg-white text-[#050d1a] font-semibold rounded-xl transition-all active:scale-[0.98] shadow-md"
            >
              {t('landing.pricing.premium.cta')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
