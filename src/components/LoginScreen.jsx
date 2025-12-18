import React from 'react';
import { Trophy, ArrowRight } from 'lucide-react';

const LoginScreen = ({ onLogin, isLoading }) => {
    return (
        <div className="h-full w-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-6">
            {/* Logo & Branding */}
            <div className="text-center mb-12">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Trophy size={40} className="text-white" />
                </div>
                <h1 className="text-4xl font-black text-white mb-2">
                    Open<span className="text-yellow-300">Quiz</span>
                </h1>
                <p className="text-white/70 text-sm">
                    Etkileşimli Yarışma & Anket Platformu
                </p>
            </div>

            {/* Login Button */}
            <button
                onClick={onLogin}
                disabled={isLoading}
                className="w-full max-w-xs bg-white text-slate-800 rounded-2xl py-4 px-6 font-bold text-lg flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
            >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google ile Giriş Yap
                <ArrowRight size={20} className="ml-auto" />
            </button>

            {/* Features hint */}
            <div className="mt-12 grid grid-cols-3 gap-4 text-center text-white/60 text-xs">
                <div>
                    <div className="text-2xl mb-1">🏆</div>
                    <span>Yarışma</span>
                </div>
                <div>
                    <div className="text-2xl mb-1">📊</div>
                    <span>Anket</span>
                </div>
                <div>
                    <div className="text-2xl mb-1">❓</div>
                    <span>Quiz</span>
                </div>
            </div>

            {/* Footer */}
            <p className="absolute bottom-8 text-white/40 text-xs">
                © 2025 Open Quiz
            </p>
        </div>
    );
};

export default LoginScreen;
