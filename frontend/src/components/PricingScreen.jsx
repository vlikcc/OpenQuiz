import { useEffect, useState } from 'react';
import { ArrowRight, Check, Trophy, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { entitlementService } from '../services/entitlementService';
import { EntitlementKeys } from '../config/entitlementKeys';
import { PLAN_LABEL_I18N } from '../config/planLabels';

const PUBLIC_PLANS = ['free', 'pro', 'team'];

const FEATURE_ROWS = [
  { key: EntitlementKeys.LimitParticipantsPerSession, labelKey: 'pricing.participants' },
  { key: EntitlementKeys.LimitActivePolls, labelKey: 'pricing.activePolls' },
  { key: EntitlementKeys.LimitSessionsPerMonth, labelKey: 'pricing.sessions' },
  { key: EntitlementKeys.LimitQuestionsPerPoll, labelKey: 'pricing.questions' },
  { key: EntitlementKeys.ContentExam, labelKey: 'pricing.exam', flag: true },
  { key: EntitlementKeys.ContentWordCloud, labelKey: 'pricing.wordcloud', flag: true },
  { key: EntitlementKeys.ReportsExport, labelKey: 'pricing.export', flag: true },
  { key: EntitlementKeys.BrandingCustom, labelKey: 'pricing.branding', flag: true },
];

function formatLimit(value, t) {
  if (value === EntitlementKeys.Unlimited || value === -1) return t('billing.unlimited');
  return String(value);
}

function formatPrice(plan, t) {
  const monthly = plan.pricing?.monthly;
  if (monthly == null) return t('pricing.contact');
  const currency = plan.pricing.currency || 'TRY';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(monthly);
  } catch {
    return `${monthly} ${currency}`;
  }
}

export default function PricingScreen({ onBack, onLogin }) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    entitlementService.plans()
      .then((rows) => {
        if (!current) return;
        setPlans((rows || []).filter((p) => PUBLIC_PLANS.includes(p.code)));
      })
      .catch(() => {})
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  return (
    <div className="h-full w-full bg-[#0a0a0f] text-white overflow-y-auto">
      <header className="border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <button type="button" onClick={onBack} className="text-white/70 hover:text-white text-sm font-bold">
            ← {t('common.back')}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Trophy size={16} className="text-white" />
            </div>
            <span className="font-black">OpenQuiz</span>
          </div>
          <button
            type="button"
            onClick={onLogin}
            className="px-4 py-2 bg-white text-slate-900 rounded-full font-bold text-sm"
          >
            {t('landing.login')}
          </button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-black mb-4">{t('pricing.title')}</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">{t('pricing.subtitle')}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-indigo-400" size={32} />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {PUBLIC_PLANS.map((code) => {
              const plan = plans.find((p) => p.code === code);
              if (!plan) return null;
              const highlighted = code === 'pro';
              const cardClass = highlighted
                ? 'relative rounded-3xl p-6 sm:p-8 border-2 border-indigo-400 bg-white/10'
                : 'relative rounded-3xl p-6 sm:p-8 border border-white/10 bg-white/5';
              return (
                <div key={code} className={cardClass}>
                  {highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-500 rounded-full text-xs font-bold">
                      {t('pricing.popular')}
                    </div>
                  )}
                  <h2 className="text-xl font-bold mb-1">{t(PLAN_LABEL_I18N[code] || code)}</h2>
                  <p className="text-3xl font-black mb-6">
                    {formatPrice(plan, t)}
                    {plan.pricing?.monthly != null && (
                      <span className="text-sm font-medium text-slate-400"> {t('pricing.perMonth')}</span>
                    )}
                  </p>
                  <ul className="space-y-3 mb-8">
                    {FEATURE_ROWS.map((row) => {
                      const value = plan.values?.[row.key];
                      const included = row.flag ? !!value : true;
                      return (
                        <li key={row.key} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check size={16} className={included ? 'text-emerald-400 mt-0.5 shrink-0' : 'text-slate-600 mt-0.5 shrink-0'} />
                          <span>
                            {t(row.labelKey)}
                            {!row.flag && <>: {formatLimit(value, t)}</>}
                            {row.flag && !included && <> — {t('pricing.notIncluded')}</>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={onLogin}
                    className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 flex items-center justify-center gap-2"
                  >
                    {t('pricing.cta')}
                    <ArrowRight size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
