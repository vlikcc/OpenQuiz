import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { voterJoinUrl } from '../utils/sessionRoute';

const CODE_LENGTH = 6;

export default function JoinByCodeForm({ onJoin = (url) => window.location.assign(url) }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    onJoin(voterJoinUrl(window.location.origin, { code }));
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <label htmlFor="join-code" className="block text-sm text-slate-400 mb-2">{t('landing.joinTitle')}</label>
      <div className="flex gap-2">
        <input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))}
          placeholder={t('landing.joinPlaceholder')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-2xl px-4 py-3 font-mono text-xl tracking-[0.3em] text-center uppercase placeholder:text-white/30 placeholder:tracking-normal placeholder:font-sans placeholder:text-base focus:outline-none focus:border-indigo-400"
        />
        <button
          type="submit"
          disabled={code.length !== CODE_LENGTH}
          className="px-5 py-3 bg-white text-slate-900 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {t('landing.joinButton')}
          <ArrowRight size={18} />
        </button>
      </div>
    </form>
  );
}
