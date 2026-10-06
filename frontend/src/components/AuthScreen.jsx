import React, { useState } from 'react';
import { Trophy, Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff, KeyRound, CheckCircle, ArrowLeft } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from '../config/constants';
import { useTranslation } from 'react-i18next';

const AuthScreen = ({ onGoogleLogin, onEmailLogin, onEmailRegister, onPasswordReset, isLoading: authLoading, onBack }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLoading = authLoading || isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email) return setError(t('auth.emailRequired'));

    if (mode === 'reset') {
      setIsSubmitting(true);
      try {
        await onPasswordReset(email);
        setSuccessMessage(t('auth.resetSent'));
      } catch (err) {
        setError(err.message || t('common.error'));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) return setError(t('auth.passwordRequired'));
    if (password.length < 8) return setError(t('auth.passwordTooShort'));

    setIsSubmitting(true);
    try {
      if (mode === 'login') await onEmailLogin(email, password);
      else await onEmailRegister(email, password, displayName || email);
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 max-w-md w-full p-8 rounded-3xl shadow-2xl">
        {onBack && (
          <button onClick={onBack} className="mb-4 text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> {t('common.back')}
          </button>
        )}

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-3">
            <Trophy size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {mode === 'login' && t('auth.loginTitle')}
            {mode === 'register' && t('auth.registerTitle')}
            {mode === 'reset' && t('auth.resetTitle')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {mode === 'login' && t('auth.loginSubtitle')}
            {mode === 'register' && t('auth.registerSubtitle')}
            {mode === 'reset' && t('auth.resetSubtitle')}
          </p>
        </div>

        {GOOGLE_CLIENT_ID && mode !== 'reset' && (
          <div className="flex justify-center mb-4">
            <GoogleLogin
              theme="outline"
              size="large"
              text={mode === 'register' ? 'signup_with' : 'signin_with'}
              onSuccess={async (cred) => {
                setIsSubmitting(true);
                setError('');
                try { await onGoogleLogin(cred.credential); }
                catch (err) { setError(err.message || t('auth.googleFailed')); }
                finally { setIsSubmitting(false); }
              }}
              onError={() => setError(t('auth.googleFailed'))}
            />
          </div>
        )}

        {mode !== 'reset' && (
          <div className="flex items-center gap-3 my-4 text-slate-400 text-xs">
            <div className="h-px bg-slate-200 flex-1" />
            {t('auth.or')}
            <div className="h-px bg-slate-200 flex-1" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                placeholder={t('auth.name')}
              />
            </div>
          )}

          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
              placeholder={t('auth.email')}
              required
            />
          </div>

          {mode !== 'reset' && (
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                placeholder={t('auth.password')}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle size={16} /> {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            {mode === 'login' && t('auth.loginTitle')}
            {mode === 'register' && t('auth.registerTitle')}
            {mode === 'reset' && t('auth.sendLink')}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-500 space-y-1">
          {mode === 'login' && (
            <>
              <div>
                {t('auth.noAccount')}{' '}
                <button className="text-indigo-600 hover:underline" onClick={() => setMode('register')}>{t('auth.register')}</button>
              </div>
              <div>
                <button className="text-indigo-600 hover:underline inline-flex items-center gap-1" onClick={() => setMode('reset')}>
                  <KeyRound size={14} /> {t('auth.forgotPassword')}
                </button>
              </div>
            </>
          )}
          {mode === 'register' && (
            <button className="text-indigo-600 hover:underline" onClick={() => setMode('login')}>{t('auth.haveAccount')}</button>
          )}
          {mode === 'reset' && (
            <button className="text-indigo-600 hover:underline" onClick={() => setMode('login')}>{t('auth.backToLogin')}</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
