import { useEffect, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function WordCloudVoter({ maxWords = 3, isSubmitting, onSubmit, onDraftChange }) {
  const { t } = useTranslation();
  const [terms, setTerms] = useState(['']);

  // The parent sends whatever has been typed when the question's timer runs
  // out, so it has to be able to see the draft.
  useEffect(() => { onDraftChange?.(terms.map((term) => term.trim()).filter(Boolean)); }, [terms, onDraftChange]);

  const updateAt = (i, val) => setTerms((t) => t.map((v, j) => (j === i ? val : v)));
  const addTerm = () => { if (terms.length < maxWords) setTerms((t) => [...t, '']); };
  const removeTerm = (i) => setTerms((t) => (t.length > 1 ? t.filter((_, j) => j !== i) : t));

  const handle = async () => {
    const cleaned = terms.map((t) => t.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    await onSubmit(cleaned);
    setTerms(['']);
  };

  return (
    <div className="space-y-3">
      {terms.map((term, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={term}
            onChange={(e) => updateAt(i, e.target.value)}
            className="flex-1 p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-sky-500"
            placeholder={t('voter.wordPlaceholder', { n: i + 1 })}
            maxLength={64}
            autoFocus={i === 0}
          />
          {terms.length > 1 && (
            <button type="button" onClick={() => removeTerm(i)} className="p-2 text-slate-400 hover:text-rose-500"><X size={20} /></button>
          )}
        </div>
      ))}

      {terms.length < maxWords && (
        <button type="button" onClick={addTerm} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-sky-400 hover:text-sky-600 text-sm">
          {t('voter.addWord', { current: terms.length, max: maxWords })}
        </button>
      )}

      <button
        onClick={handle}
        disabled={isSubmitting || terms.every((t) => !t.trim())}
        className="w-full py-4 bg-sky-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-sky-700 disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
        {t('common.submit')}
      </button>
      <p className="text-xs text-center text-slate-400">{t('voter.wordCloudHint')}</p>
    </div>
  );
}
