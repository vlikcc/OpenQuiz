import React, { useState } from 'react';
import { Trophy, Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff, KeyRound, CheckCircle, ArrowLeft } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const AuthScreen = ({ onGoogleLogin, onEmailLogin, onEmailRegister, onPasswordReset, isLoading: authLoading, onBack }) => {
    const [mode, setMode] = useState('login'); // 'login', 'register', 'reset'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isNative = Capacitor.isNativePlatform();
    const isLoading = authLoading || isSubmitting;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        console.log('Form submitted, mode:', mode, 'email:', email);

        if (!email) {
            setError('Email gerekli');
            return;
        }

        // Password reset mode
        if (mode === 'reset') {
            setIsSubmitting(true);
            try {
                await onPasswordReset(email);
                setSuccessMessage('Şifre sıfırlama linki email adresinize gönderildi. Lütfen emailinizi kontrol edin.');
            } catch (err) {
                console.error('Password reset error:', err);
                setError(err.message || 'Bir hata oluştu');
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        if (!password) {
            setError('Şifre gerekli');
            return;
        }

        if (password.length < 6) {
            setError('Şifre en az 6 karakter olmalı');
            return;
        }

        if (mode === 'register' && !displayName) {
            setError('İsim gerekli');
            return;
        }

        setIsSubmitting(true);
        try {
            if (mode === 'register') {
                console.log('Registering user...');
                await onEmailRegister(email, password, displayName);
            } else {
                console.log('Logging in user...');
                await onEmailLogin(email, password);
            }
            console.log('Auth successful!');
        } catch (err) {
            console.error('Auth error:', err);
            setError(err.message || 'Bir hata oluştu');
        } finally {
            setIsSubmitting(false);
        }
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setError('');
        setSuccessMessage('');
    };

    const getModeTitle = () => {
        switch (mode) {
            case 'register': return 'Yeni hesap oluştur';
            case 'reset': return 'Şifre belirle / sıfırla';
            default: return 'Hoş geldiniz';
        }
    };

    return (
        <div className="h-full w-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col overflow-hidden">
            {/* Back Button */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="absolute top-6 left-6 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors z-10"
                >
                    <ArrowLeft size={24} />
                </button>
            )}

            {/* Header */}
            <div className="pt-12 pb-8 px-6 text-center shrink-0">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                    <Trophy size={40} className="text-white" />
                </div>
                <h1 className="text-3xl font-black text-white mb-1">
                    Open<span className="text-yellow-300">Quiz</span>
                </h1>
                <p className="text-white/70 text-sm">
                    {getModeTitle()}
                </p>
            </div>

            {/* Form Area */}
            <div className="flex-1 bg-white rounded-t-[2rem] px-6 pt-8 pb-6 overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name Field (only for register) */}
                    {mode === 'register' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                İsim
                            </label>
                            <div className="relative">
                                <User size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Adınız Soyadınız"
                                    className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Email Field */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Email
                        </label>
                        <div className="relative">
                            <Mail size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ornek@email.com"
                                autoComplete="email"
                                className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Password Field (not for reset mode) */}
                    {mode !== 'reset' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Şifre
                            </label>
                            <div className="relative">
                                <Lock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                                    className="w-full pl-11 pr-12 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            {mode === 'register' && (
                                <p className="text-xs text-slate-500 mt-1">En az 6 karakter</p>
                            )}
                        </div>
                    )}

                    {/* Reset Password Info */}
                    {mode === 'reset' && (
                        <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded-xl text-sm">
                            <div className="flex items-start gap-2">
                                <KeyRound size={18} className="mt-0.5 shrink-0" />
                                <div>
                                    <strong>Google ile kayıt oldunuz mu?</strong>
                                    <p className="mt-1 text-indigo-600">
                                        Email adresinizi girin. Size şifre belirleme linki göndereceğiz.
                                        Bu şifreyi mobil uygulamada giriş yapmak için kullanabilirsiniz.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success Message */}
                    {successMessage && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                            <CheckCircle size={18} className="mt-0.5 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-70"
                    >
                        {isLoading ? (
                            <Loader2 size={24} className="animate-spin" />
                        ) : (
                            <>
                                {mode === 'register' ? 'Kayıt Ol' : mode === 'reset' ? 'Şifre Linki Gönder' : 'Giriş Yap'}
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>

                    {/* Forgot Password Link (only on login mode) */}
                    {mode === 'login' && (
                        <button
                            type="button"
                            onClick={() => switchMode('reset')}
                            className="w-full text-center text-indigo-600 text-sm font-medium hover:underline"
                        >
                            Şifremi unuttum / Şifre belirle
                        </button>
                    )}
                </form>

                {/* Divider */}
                {!isNative && mode === 'login' && (
                    <>
                        <div className="flex items-center my-6">
                            <div className="flex-1 border-t border-slate-200"></div>
                            <span className="px-4 text-sm text-slate-500">veya</span>
                            <div className="flex-1 border-t border-slate-200"></div>
                        </div>

                        {/* Google Login (only on web) */}
                        <button
                            onClick={onGoogleLogin}
                            disabled={isLoading}
                            className="w-full bg-white border-2 border-slate-200 text-slate-800 py-3 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Google ile Devam Et
                        </button>
                    </>
                )}

                {/* Mode Toggle Links */}
                <div className="mt-6 text-center space-y-2">
                    {mode === 'login' && (
                        <button
                            onClick={() => switchMode('register')}
                            className="text-indigo-600 font-medium hover:underline"
                        >
                            Hesabınız yok mu? Kayıt Olun
                        </button>
                    )}
                    {mode === 'register' && (
                        <button
                            onClick={() => switchMode('login')}
                            className="text-indigo-600 font-medium hover:underline"
                        >
                            Zaten hesabınız var mı? Giriş Yapın
                        </button>
                    )}
                    {mode === 'reset' && (
                        <button
                            onClick={() => switchMode('login')}
                            className="text-indigo-600 font-medium hover:underline"
                        >
                            ← Giriş ekranına dön
                        </button>
                    )}
                </div>

                {/* Features hint */}
                <div className="mt-8 grid grid-cols-3 gap-2 text-center text-slate-400 text-xs">
                    <div>
                        <div className="text-xl mb-1">🏆</div>
                        <span>Yarışma</span>
                    </div>
                    <div>
                        <div className="text-xl mb-1">📊</div>
                        <span>Anket</span>
                    </div>
                    <div>
                        <div className="text-xl mb-1">❓</div>
                        <span>Quiz</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;
