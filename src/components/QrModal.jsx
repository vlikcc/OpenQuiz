import { X } from 'lucide-react';

export default function QrModal({ pollId, onClose, title }) {
  const currentUrl = window.location.origin; 
  const joinUrl = `${currentUrl}?mode=voter&id=${pollId}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(joinUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
        >
          <X size={20} className="text-slate-600" />
        </button>
        
        <div className="p-8 flex flex-col items-center text-center">
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Yarışmaya Katıl</h3>
          <p className="text-slate-500 mb-6 px-4">{title}</p>
          
          <div className="bg-white p-4 rounded-xl border-2 border-slate-100 shadow-inner mb-6">
            <img src={qrImageUrl} alt="QR Code" className="w-64 h-64 object-contain" />
          </div>
          
          <div className="bg-indigo-50 text-indigo-700 px-6 py-3 rounded-xl font-mono text-lg font-bold border border-indigo-100 mb-2">
            ID: {pollId.slice(0, 6)}...
          </div>
          <p className="text-xs text-slate-400">Telefonunuzun kamerasıyla okutun</p>
        </div>
      </div>
    </div>
  );
}

