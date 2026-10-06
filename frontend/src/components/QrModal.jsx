import { useState, useEffect } from 'react';
import { X, Copy, Share2, Users, CheckCircle, Link } from 'lucide-react';
import { realtimeService } from '../services/realtimeService';
import { pollService } from '../services/pollService';
import { useTranslation } from 'react-i18next';
import { voterJoinUrl } from '../utils/sessionRoute';

export default function QrModal({ pollId, onClose, title, joinCode: joinCodeProp }) {
  const { t } = useTranslation();
  const [participantCount, setParticipantCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState(joinCodeProp || '');
  const [qrImageUrl, setQrImageUrl] = useState('');

  const joinUrl = voterJoinUrl(window.location.origin, { code: joinCode, pollId });

  useEffect(() => {
    let active = true;
    pollService.get(pollId).then((p) => {
      if (!active || !p) return;
      setParticipantCount(p.participantCount || 0);
      if (p.joinCode) setJoinCode(p.joinCode);
    }).catch(() => {});
    const unsubPromise = realtimeService.subscribe(pollId, {
      onPollUpdated: (p) => { if (active) setParticipantCount(p.participantCount || 0); },
    });
    return () => { active = false; unsubPromise.then((u) => u && u()); };
  }, [pollId]);

  useEffect(() => {
    let cancelled = false;
    import('qrcode').then((mod) => mod.default.toDataURL(joinUrl, { width: 448, margin: 1, errorCorrectionLevel: 'M' }))
      .then((url) => { if (!cancelled) setQrImageUrl(url); })
      .catch(() => { if (!cancelled) setQrImageUrl(''); });
    return () => { cancelled = true; };
  }, [joinUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy error:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || t('qr.shareTitle'),
          text: t('qr.shareText', { title: title || '' }),
          url: joinUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share error:', err);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative">
        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors z-10"
        >
          <X size={20} className="text-slate-600" />
        </button>

        <div className="p-8 flex flex-col items-center text-center">
          <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('qr.title')}</h3>
          <p className="text-slate-500 mb-4 px-4">{title}</p>

          {joinCode && (
            <p className="font-mono tracking-[0.35em] text-4xl sm:text-5xl font-black text-slate-900 mb-4">
              {joinCode}
            </p>
          )}

          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full mb-4 animate-pulse">
            <Users size={18} />
            <span className="font-semibold">{t('qr.participantsWaiting', { count: participantCount })}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border-2 border-slate-100 shadow-inner mb-4">
            {qrImageUrl ? (
              <img src={qrImageUrl} alt={t('qr.title')} className="w-56 h-56 object-contain" />
            ) : (
              <div className="w-56 h-56 bg-slate-100 rounded-lg" />
            )}
          </div>

          <div className="w-full bg-slate-50 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
              <Link size={14} />
              <span>{t('qr.shareLink')}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinUrl}
                readOnly
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 truncate"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                aria-label={t('qr.copyLink')}
                className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1 ${copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                  }`}
              >
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleShare}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg"
          >
            <Share2 size={18} />
            {t('qr.shareButton')}
          </button>

          <p className="text-xs text-slate-400 mt-4">{t('qr.scanHint')}</p>
        </div>
      </div>
    </div>
  );
}
