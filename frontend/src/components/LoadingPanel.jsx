import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Suspense fallback for the screens that arrive in their own chunk. */
export default function LoadingPanel({ dark = false }) {
  const { t } = useTranslation();

  return (
    <div className={`h-full w-full flex items-center justify-center ${dark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <div className="text-center">
        <Loader2 className={`animate-spin mx-auto mb-4 ${dark ? 'text-white' : 'text-indigo-600'}`} size={40} />
        <p className={dark ? 'text-white/70' : 'text-slate-500'}>{t('common.loading')}</p>
      </div>
    </div>
  );
}
