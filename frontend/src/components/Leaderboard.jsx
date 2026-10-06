import { Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * The standings, ordered by points and then by how quickly they were earned.
 * Rendered on the presentation screen while a session is running, so the top of
 * the table is deliberately larger than the tail.
 */
export default function Leaderboard({ entries, tone = 'dark', highlightCount = 3 }) {
  const { t } = useTranslation();
  const styles = tone === 'dark' ? DARK : LIGHT;

  if (entries.length === 0) {
    return <p className={`italic ${styles.empty}`}>{t('results.noScores')}</p>;
  }

  return (
    <ol className="space-y-2">
      {entries.map((entry, index) => (
        <li
          key={`${entry.userName}-${index}`}
          className={`flex items-center gap-3 rounded-xl px-4 ${index < highlightCount ? `py-4 ${styles.top}` : `py-2.5 ${styles.rest}`}`}
        >
          <span className={`w-10 shrink-0 text-center font-black ${index < highlightCount ? 'text-2xl' : styles.rank}`}>
            {MEDALS[index] ?? index + 1}
          </span>
          <span className={`flex-1 truncate font-bold ${index < highlightCount ? 'text-xl' : ''}`}>
            {entry.userName}
          </span>
          <span className={`shrink-0 font-black tabular-nums ${index === 0 ? styles.leader : ''}`}>
            {index === 0 && <Crown size={16} className="inline -mt-1 mr-1" />}
            {t('results.points', { n: entry.points })}
          </span>
        </li>
      ))}
    </ol>
  );
}

const DARK = {
  top: 'bg-white/15',
  rest: 'bg-white/5',
  rank: 'text-white/40',
  leader: 'text-amber-300',
  empty: 'text-white/40',
};

const LIGHT = {
  top: 'bg-indigo-50 border border-indigo-100 text-slate-800',
  rest: 'bg-slate-50 text-slate-700',
  rank: 'text-slate-400',
  leader: 'text-amber-600',
  empty: 'text-slate-400',
};
