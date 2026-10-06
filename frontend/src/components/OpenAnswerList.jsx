import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * The written answers to one question, with grading for whoever owns the poll.
 * An exam's open half used to be read out and then forgotten, because nothing
 * on screen could turn a written answer into points.
 */
export default function OpenAnswerList({ answers, maxPoints = 10, onScore = null, tone = 'dark' }) {
  const { t } = useTranslation();
  const styles = tone === 'dark' ? DARK : LIGHT;

  if (answers.length === 0) {
    return <p className={`italic ${styles.empty}`}>{t('presenter.noAnswers')}</p>;
  }

  return (
    <ul className="space-y-2">
      {answers.map((answer) => (
        <li key={answer.id} className={`rounded-lg p-3 ${styles.row}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`text-xs mb-1 ${styles.meta}`}>{answer.userName}</div>
              <div className="break-words">{answer.answerText}</div>
            </div>
            {onScore ? (
              <Grader answer={answer} maxPoints={maxPoints} onScore={onScore} styles={styles} />
            ) : (
              answer.score !== null && answer.score !== undefined && (
                <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${styles.badge}`}>
                  {t('grading.scored', { score: answer.score, max: maxPoints })}
                </span>
              )
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Grader({ answer, maxPoints, onScore, styles }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(answer.score ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const save = async (value) => {
    setIsSaving(true);
    try {
      await onScore(answer, value);
      setDraft(value ?? '');
    } finally {
      setIsSaving(false);
    }
  };

  const parsed = draft === '' ? null : Number(draft);
  const isValid = parsed === null || (Number.isFinite(parsed) && parsed >= 0 && parsed <= maxPoints);

  return (
    <div className="shrink-0 flex items-center gap-1">
      <label className="sr-only" htmlFor={`score-${answer.id}`}>{t('grading.score')}</label>
      <input
        id={`score-${answer.id}`}
        type="number"
        min="0"
        max={maxPoints}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className={`w-16 p-1 text-sm text-center font-bold rounded-lg outline-none ${styles.input}`}
      />
      <span className={`text-xs ${styles.meta}`}>{t('grading.outOf', { max: maxPoints })}</span>
      <button
        type="button"
        onClick={() => save(parsed)}
        disabled={isSaving || !isValid}
        aria-label={t('grading.award')}
        className={`p-1.5 rounded-lg disabled:opacity-40 ${styles.award}`}
      >
        <Check size={16} />
      </button>
      {answer.score !== null && answer.score !== undefined && (
        <button
          type="button"
          onClick={() => save(null)}
          disabled={isSaving}
          aria-label={t('grading.clear')}
          className={`p-1.5 rounded-lg disabled:opacity-40 ${styles.clear}`}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

const DARK = {
  row: 'bg-white/10',
  meta: 'text-white/50',
  empty: 'text-white/40',
  badge: 'bg-emerald-500/20 text-emerald-200',
  input: 'bg-white/10 text-white border border-white/20 focus:border-white/50',
  award: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  clear: 'bg-white/10 hover:bg-white/20 text-white',
};

const LIGHT = {
  row: 'bg-slate-50 border border-slate-200 text-slate-700',
  meta: 'text-slate-400',
  empty: 'text-slate-400',
  badge: 'bg-emerald-100 text-emerald-700',
  input: 'bg-white text-slate-700 border border-slate-300 focus:border-indigo-500',
  award: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  clear: 'bg-slate-200 hover:bg-slate-300 text-slate-600',
};
