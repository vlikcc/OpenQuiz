import { useState, useEffect } from 'react';
import { Users, Loader2, Clock, Trophy } from 'lucide-react';
import { CONTENT_TYPES } from '../config/firebase';

export default function WaitingRoom({ poll, participantCount, userName }) {
    const [dots, setDots] = useState('');

    const typeConfig = poll ? CONTENT_TYPES[poll.type] : null;

    // Animasyonlu üç nokta
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
        <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 text-white">
            {/* İkon */}
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-6 animate-pulse">
                <span className="text-5xl">{typeConfig?.icon || '🎯'}</span>
            </div>

            {/* Başlık */}
            <h1 className="text-2xl font-bold text-center mb-2">{poll.title}</h1>
            <p className="text-white/70 text-center mb-8">
                {typeConfig?.label || 'Yarışma'}
            </p>

            {/* Hoşgeldin Mesajı */}
            {userName && (
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-3 mb-6">
                    <p className="text-lg">
                        Hoş geldin, <span className="font-bold text-yellow-300">{userName}</span>! 👋
                    </p>
                </div>
            )}

            {/* Katılımcı Sayısı */}
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 mb-8">
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Users size={24} />
                </div>
                <div>
                    <p className="text-3xl font-black">{participantCount || 0}</p>
                    <p className="text-white/70 text-sm">katılımcı bekleniyor</p>
                </div>
            </div>

            {/* Bekleme Mesajı */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-6 text-center max-w-sm">
                <div className="flex items-center justify-center gap-2 mb-3">
                    <Clock size={20} className="text-yellow-300" />
                    <span className="font-semibold">Yönetici bekleniyor{dots}</span>
                </div>
                <p className="text-white/70 text-sm">
                    Yarışma yönetici tarafından başlatıldığında sorular otomatik olarak görünecek.
                </p>
            </div>

            {/* Soru Sayısı Bilgisi */}
            {poll.questions && (
                <div className="mt-6 text-white/50 text-sm flex items-center gap-2">
                    <Trophy size={16} />
                    <span>{poll.questions.length} soru hazırlandı</span>
                </div>
            )}

            {/* Animasyonlu Dots */}
            <div className="mt-8 flex gap-2">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="w-3 h-3 bg-white/50 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>
        </div>
    );
}
