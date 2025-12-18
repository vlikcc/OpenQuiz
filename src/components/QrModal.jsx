import { useState, useEffect } from 'react';
import { X, Copy, Share2, Users, CheckCircle, Link } from 'lucide-react';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export default function QrModal({ pollId, onClose, title }) {
  const [participantCount, setParticipantCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentUrl = window.location.origin;
  const joinUrl = `${currentUrl}?mode=voter&id=${pollId}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(joinUrl)}`;

  // Katılımcı sayısını dinle
  useEffect(() => {
    const pollRef = doc(db, 'artifacts', appId, 'public', 'data', 'polls', pollId);

    const unsubscribe = onSnapshot(pollRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setParticipantCount(data.participantCount || 0);
      }
    });

    return () => unsubscribe();
  }, [pollId]);

  // Link kopyala
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Kopyalama hatası:', err);
    }
  };

  // Paylaş (Web Share API)
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || 'Yarışmaya Katıl',
          text: `${title} yarışmasına katılmak için linke tıkla!`,
          url: joinUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Paylaşım hatası:', err);
        }
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
          className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors z-10"
        >
          <X size={20} className="text-slate-600" />
        </button>

        <div className="p-8 flex flex-col items-center text-center">
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Yarışmaya Katıl</h3>
          <p className="text-slate-500 mb-4 px-4">{title}</p>

          {/* Katılımcı Sayacı */}
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full mb-4 animate-pulse">
            <Users size={18} />
            <span className="font-semibold">{participantCount} katılımcı bekleniyor</span>
          </div>

          {/* QR Kod */}
          <div className="bg-white p-4 rounded-xl border-2 border-slate-100 shadow-inner mb-4">
            <img src={qrImageUrl} alt="QR Code" className="w-56 h-56 object-contain" />
          </div>

          {/* Link Alanı */}
          <div className="w-full bg-slate-50 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
              <Link size={14} />
              <span>veya linki paylaş</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinUrl}
                readOnly
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 truncate"
              />
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1 ${copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                  }`}
              >
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          {/* Paylaş Butonu */}
          <button
            onClick={handleShare}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg"
          >
            <Share2 size={18} />
            Linki Paylaş
          </button>

          <p className="text-xs text-slate-400 mt-4">Telefonun kamerasıyla QR'ı okut veya linki paylaş</p>
        </div>
      </div>
    </div>
  );
}
