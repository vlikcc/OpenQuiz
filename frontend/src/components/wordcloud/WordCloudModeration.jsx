import { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { splitBlacklist } from '../../utils/wordCloudSettings';

/**
 * The moderation an organiser sets before a word cloud goes on a wall in front
 * of a room. Collapsed by default because the defaults are the sensible ones:
 * profanity filtered, one vote per word per person, fifty words on screen.
 */
export default function WordCloudModeration({ index, moderation, onChange }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(() => hasChanges(moderation));

  const set = (field, value) => onChange({ ...moderation, [field]: value });
  const blockedCount = splitBlacklist(moderation.blacklist).length;

  return (
    <div className="border border-sky-200 rounded-lg bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-sky-50"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-sky-800">
          <ShieldCheck size={16} /> {t('moderation.title')}
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {t('moderation.summary', { top: moderation.topN, blocked: blockedCount })}
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {isOpen && (
        <div className="p-3 pt-0 space-y-3 border-t border-sky-100">
          <div>
            <label htmlFor={`blacklist-${index}`} className="block text-xs font-bold text-slate-500 uppercase mb-1 mt-3">
              {t('moderation.blacklist')}
            </label>
            <input
              id={`blacklist-${index}`}
              type="text"
              value={moderation.blacklist}
              onChange={(e) => set('blacklist', e.target.value)}
              placeholder={t('moderation.blacklistPlaceholder')}
              className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-sky-500"
            />
            <p className="mt-1 text-xs text-slate-400">{t('moderation.blacklistHint')}</p>
          </div>

          <div className="flex items-end gap-4">
            <div className="w-28">
              <label htmlFor={`topn-${index}`} className="block text-xs font-bold text-slate-500 uppercase mb-1">
                {t('moderation.topN')}
              </label>
              <input
                id={`topn-${index}`}
                type="number"
                min="1"
                max="500"
                value={moderation.topN}
                onChange={(e) => set('topN', parseInt(e.target.value, 10) || 50)}
                className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-sky-500 text-center font-bold"
              />
            </div>
            <p className="flex-1 text-xs text-slate-400 pb-2">{t('moderation.topNHint')}</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={moderation.profanityFilter}
              onChange={(e) => set('profanityFilter', e.target.checked)}
              className="w-5 h-5 accent-sky-600 cursor-pointer"
            />
            <span className="text-sm font-medium text-slate-700">{t('moderation.profanityFilter')}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={moderation.allowDuplicatesFromSameUser}
              onChange={(e) => set('allowDuplicatesFromSameUser', e.target.checked)}
              className="w-5 h-5 accent-sky-600 cursor-pointer"
            />
            <span className="text-sm font-medium text-slate-700">{t('moderation.allowRepeats')}</span>
          </label>
        </div>
      )}
    </div>
  );
}

/** An author editing a moderated question should see what they set. */
function hasChanges(moderation) {
  return Boolean(moderation.blacklist)
    || moderation.topN !== 50
    || moderation.profanityFilter === false
    || moderation.allowDuplicatesFromSameUser === true;
}
