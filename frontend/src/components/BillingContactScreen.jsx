import { useState } from 'react';
import { ArrowRight, Check, Copy, Mail, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BILLING_CONTACT_EMAIL } from '../config/constants';
import { PLAN_LABEL_I18N } from '../config/planLabels';

function requestLines({ t, planLabel, email, userId }) {
  return t('billing.contactRequestBody', {
    plan: planLabel,
    email: email || t('billing.contactEmailUnknown'),
    userId: userId || t('billing.contactUserUnknown'),
  });
}

export default function BillingContactScreen({ planCode, user, onBack, onLogin }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const planLabel = planCode
    ? t(PLAN_LABEL_I18N[planCode] || planCode)
    : t('billing.contactAnyPlan');
  const body = requestLines({
    t,
    planLabel,
    email: user?.email,
    userId: user?.id,
  });

  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const mailHref = BILLING_CONTACT_EMAIL
    ? `mailto:${BILLING_CONTACT_EMAIL}?subject=${encodeURIComponent(t('billing.contactMailSubject', { plan: planLabel }))}&body=${encodeURIComponent(body)}`
    : null;

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
          {user ? (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 bg-white text-slate-900 rounded-full font-bold text-sm"
            >
              {t('billing.contactContinue')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="px-4 py-2 bg-white text-slate-900 rounded-full font-bold text-sm"
            >
              {t('landing.login')}
            </button>
          )}
        </div>
      </header>

      <section className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-indigo-300 text-sm font-bold mb-3">{t('billing.contactEyebrow')}</p>
        <h1 className="text-3xl sm:text-4xl font-black mb-4">{t('billing.contactTitle')}</h1>
        <p className="text-slate-400 text-lg mb-8">{t('billing.contactSubtitle', { plan: planLabel })}</p>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">{t('billing.contactRequestedPlan')}</div>
            <div className="text-xl font-bold">{planLabel}</div>
          </div>

          {user?.email && (
            <div>
              <div className="text-xs text-slate-500 mb-1">{t('billing.contactAccount')}</div>
              <div className="font-medium break-all">{user.email}</div>
            </div>
          )}

          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
            <li>{t('billing.contactStep1')}</li>
            <li>{t('billing.contactStep2')}</li>
            <li>{t('billing.contactStep3')}</li>
          </ol>

          <pre className="whitespace-pre-wrap break-all text-sm bg-black/40 rounded-xl p-4 text-slate-200">{body}</pre>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={copyRequest}
              className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 flex items-center justify-center gap-2"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t('billing.contactCopied') : t('billing.contactCopy')}
            </button>
            {mailHref && (
              <a
                href={mailHref}
                className="flex-1 py-3 rounded-xl font-bold border border-white/20 hover:bg-white/10 flex items-center justify-center gap-2"
              >
                <Mail size={16} />
                {t('billing.contactMail')}
              </a>
            )}
          </div>

          {!user && (
            <button
              type="button"
              onClick={onLogin}
              className="w-full py-3 rounded-xl font-bold bg-white text-slate-900 flex items-center justify-center gap-2"
            >
              {t('billing.contactSignIn')}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
