import { useState, useEffect } from 'react';
import { Users, Loader2, Clock, Trophy } from 'lucide-react';
import { CONTENT_TYPES, POLL_TYPE_KEY } from '../config/constants';
import { useTranslation } from 'react-i18next';

export default function WaitingRoom({ poll, participantCount, userName, branding = null }) {
    const { t } = useTranslation();
    const [dots, setDots] = useState('');

    const typeKey = poll ? (typeof poll.type === 'number' ? POLL_TYPE_KEY[poll.type] : poll.type) : null;
    const typeConfig = typeKey ? CONTENT_TYPES[typeKey] : null;
    const ct = (key) => t(`contentTypes.${key}.label`);
    const customBg = !!branding?.primaryColor;
    const shellClass = customBg
        ? 'h-full w-full flex flex-col items-center justify-center p-6 text-white'
        : 'h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 text-white';
    const shellStyle = customBg
        ? { background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.accentColor || branding.primaryColor})` }
        : undefined;

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);
        return () => clearInterval(interval);
    }, []);

    if (!poll) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700">
                <Loader2 className="animate-spin text-white" size={40} />
            </div>
        );
    }

    return (
        <div className={shellClass} style={shellStyle}>
            {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt="" className="h-20 w-20 object-contain rounded-3xl mb-6 bg-white/20 p-2" />
            ) : (
                <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-6 animate-pulse">
                    <span className="text-5xl">{typeConfig?.icon || '🎯'}</span>
                </div>
            )}

            <h1 className="text-2xl font-bold text-center mb-2">{poll.title}</h1>
            <p className="text-white/70 text-center mb-8">
                {typeKey ? ct(typeKey) : t('contentTypes.contest.label')}
            </p>

            {userName && (
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-3 mb-6">
                    <p className="text-lg">
                        {t('waiting.welcome', { name: '' }).split('{{name}}')[0]}
                        <span className="font-bold text-yellow-300">{userName}</span>
                        ! 👋
                    </p>
                </div>
            )}

            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 mb-8">
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Users size={24} />
                </div>
                <div>
                    <p className="text-3xl font-black">{participantCount || 0}</p>
                    <p className="text-white/70 text-sm">{t('waiting.waiting')}</p>
                </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-6 text-center max-w-sm">
                <div className="flex items-center justify-center gap-2 mb-3">
                    <Clock size={20} className="text-yellow-300" />
                    <span className="font-semibold">{t('waiting.managerWaiting')}{dots}</span>
                </div>
                <p className="text-white/70 text-sm">
                    {branding?.joinMessage || t('waiting.managerHint')}
                </p>
            </div>

            {poll.questions && (
                <div className="mt-6 text-white/70 text-sm flex items-center gap-2">
                    <Trophy size={16} />
                    <span>{t('waiting.preparedCount', { n: poll.questions.length })}</span>
                </div>
            )}

            <div className="mt-8 flex gap-2">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="w-3 h-3 bg-white/50 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>

            {!branding?.hideOpenQuizBranding && (
                <p className="mt-8 text-xs text-white/40">{t('waiting.poweredBy')}</p>
            )}
        </div>
    );
}
