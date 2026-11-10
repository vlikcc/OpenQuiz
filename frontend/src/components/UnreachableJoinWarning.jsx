import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function UnreachableJoinWarning({ className = '' }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className={`flex gap-2 text-left bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs ${className}`}>
      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">{t('qr.unreachableTitle')}</p>
        <p>{t('qr.unreachableBody')}</p>
      </div>
    </div>
  );
}
