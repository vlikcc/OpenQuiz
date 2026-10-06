import { useState } from 'react';
import { Trophy, Lock, ArrowRight, Loader2, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/authService';
import { tokenStore } from '../services/tokenStore';

/**
 * Completes the e-mail reset link (`/reset-password?token=`). Requesting a
 * reset already existed; following the mail used to land on the homepage
 * because nothing consumed the token.
 */
export default function ResetPasswordScreen({ token, onFinished }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const missingToken = !token;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) return setError(t('auth.passwordRequired'));
    if (password.length < 8) return setError(t('auth.passwordTooShort'));
    if (password !== confirm) return setError(t('auth.passwordMismatch'));

    setIsSubmitting(true);
    try {
      await authService.passwordResetConfirm(token, password);
      // The API revokes every refresh token; a leftover access token in this
      // tab would only fail on the next call.
      tokenStore.clear();
      setDone(true);
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-3">
            <Trophy size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('auth.resetCompleteTitle')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('auth.resetCompleteSubtitle')}</p>
        </div>

        {missingToken && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {t('auth.resetInvalid')}
          </div>
        )}

        {done && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle size={16} /> {t('auth.resetDone')}
          </div>
        )}

        {!missingToken && !done && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                placeholder={t('auth.newPassword')}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                placeholder={t('auth.confirmPassword')}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {t('auth.savePassword')}
            </button>
          </form>
        )}

        {(missingToken || done) && (
          <button
            type="button"
            onClick={onFinished}
            className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
          >
            {t('auth.goToLogin')}
          </button>
        )}
      </div>
    </div>
  );
}
