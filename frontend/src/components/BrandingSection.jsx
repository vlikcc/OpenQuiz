import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EntitlementKeys } from '../config/entitlementKeys';
import { brandingService } from '../services/brandingService';
import Gate from './Gate';

const EMPTY = {
  logoUrl: '',
  primaryColor: '',
  accentColor: '',
  hideOpenQuizBranding: false,
  joinMessage: '',
};

export default function BrandingSection({ showToast }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    brandingService.getMine()
      .then((row) => {
        if (!current || !row) return;
        setForm({
          logoUrl: row.logoUrl || '',
          primaryColor: row.primaryColor || '',
          accentColor: row.accentColor || '',
          hideOpenQuizBranding: !!row.hideOpenQuizBranding,
          joinMessage: row.joinMessage || '',
        });
      })
      .catch(() => {});
    return () => { current = false; };
  }, []);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await brandingService.update({
        logoUrl: form.logoUrl || null,
        primaryColor: form.primaryColor || null,
        accentColor: form.accentColor || null,
        hideOpenQuizBranding: form.hideOpenQuizBranding,
        joinMessage: form.joinMessage || null,
      });
      setForm({
        logoUrl: saved.logoUrl || '',
        primaryColor: saved.primaryColor || '',
        accentColor: saved.accentColor || '',
        hideOpenQuizBranding: !!saved.hideOpenQuizBranding,
        joinMessage: saved.joinMessage || '',
      });
      showToast?.(t('branding.saved'));
    } catch (err) {
      if (!err?.planLimit) showToast?.(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-fuchsia-100 rounded-xl flex items-center justify-center">
          <Palette size={20} className="text-fuchsia-600" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-slate-800">{t('branding.title')}</div>
          <div className="text-xs text-slate-500">{t('branding.subtitle')}</div>
        </div>
      </div>

      <Gate
        feature={EntitlementKeys.BrandingCustom}
        fallback={<p className="text-xs text-slate-400">{t('billing.featureLockedBrandingCustom')}</p>}
      >
        <form onSubmit={handleSave} className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-600">{t('branding.logoUrl')}</span>
              <input
                type="url"
                value={form.logoUrl}
                onChange={set('logoUrl')}
                placeholder="https://"
                className="mt-1 w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <span className="text-xs font-bold text-slate-600">{t('branding.primaryColor')}</span>
                <input
                  type="color"
                  value={form.primaryColor || '#4F46E5'}
                  onChange={set('primaryColor')}
                  className="mt-1 h-10 w-full border border-slate-200 rounded-lg"
                />
              </label>
              <label className="flex-1">
                <span className="text-xs font-bold text-slate-600">{t('branding.accentColor')}</span>
                <input
                  type="color"
                  value={form.accentColor || '#EC4899'}
                  onChange={set('accentColor')}
                  className="mt-1 h-10 w-full border border-slate-200 rounded-lg"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-bold text-slate-600">{t('branding.joinMessage')}</span>
              <input
                type="text"
                maxLength={280}
                value={form.joinMessage}
                onChange={set('joinMessage')}
                className="mt-1 w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.hideOpenQuizBranding}
                onChange={set('hideOpenQuizBranding')}
              />
              {t('branding.hideOpenQuiz')}
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-bold"
            >
              {t('branding.save')}
            </button>
          </form>
        </Gate>
    </div>
  );
}
