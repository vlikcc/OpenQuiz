import { X, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PLAN_LABEL_I18N } from '../config/planLabels';

// Maps a backend limitKey/featureKey (see OpenQuiz.Application.Billing.EntitlementKeys)
// to the i18n key that explains it in the user's language.
const LIMIT_KEY_I18N = {
  'limits.activePolls': 'billing.limitReachedActivePolls',
  'limits.participantsPerSession': 'billing.limitReachedParticipants',
  'limits.sessionsPerMonth': 'billing.limitReachedSessionsPerMonth',
  'limits.questionsPerPoll': 'billing.limitReachedQuestionsPerPoll',
};

const FEATURE_KEY_I18N = {
  'content.exam': 'billing.featureLockedContentExam',
  'content.wordcloud': 'billing.featureLockedContentWordcloud',
  'content.katex': 'billing.featureLockedContentKatex',
  'reports.export': 'billing.featureLockedReportsExport',
  'reports.advanced': 'billing.featureLockedReportsAdvanced',
  'branding.custom': 'billing.featureLockedBrandingCustom',
};

/**
 * Raised from anywhere a 402 (plan_limit_exceeded / plan_feature_required)
 * comes back from the API — see apiClient.js's setPlanLimitHandler wiring in
 * App.jsx. There is no self-serve checkout yet (see IPaymentProvider phase
 * 3), so this is informational rather than a purchase flow.
 */
export default function UpgradeModal({ info, onClose }) {
  const { t } = useTranslation();
  if (!info) return null;

  const isFeature = info.code === 'plan_feature_required';
  const explanation = isFeature
    ? t(FEATURE_KEY_I18N[info.featureKey] || 'billing.featureLockedTitle')
    : t(LIMIT_KEY_I18N[info.limitKey] || 'billing.limitReachedTitle');
  const requiredPlanLabel = info.requiredPlan
    ? t(PLAN_LABEL_I18N[info.requiredPlan] || info.requiredPlan)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors z-10"
        >
          <X size={20} className="text-slate-600" />
        </button>

        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
            <Lock size={26} className="text-amber-600" />
          </div>

          <h3 className="text-xl font-bold text-slate-800 mb-2">
            {t(isFeature ? 'billing.featureLockedTitle' : 'billing.limitReachedTitle')}
          </h3>
          <p className="text-slate-500 mb-1">{explanation}</p>
          {requiredPlanLabel && (
            <p className="text-slate-400 text-sm mb-4">{t('billing.requiredPlan', { plan: requiredPlanLabel })}</p>
          )}

          <p className="text-sm text-slate-400 mt-2">{t('billing.manageHint')}</p>
        </div>
      </div>
    </div>
  );
}
