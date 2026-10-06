import { Suspense, lazy, useEffect, useState } from 'react';
import { BookMarked, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { bankItemToDraft, draftToBankRequest, questionBankService } from '../services/questionBankService';

const FileImport = lazy(() => import('./FileImport'));

export default function QuestionBankPanel({ showToast, onPick, compact = false }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [showImport, setShowImport] = useState(false);

  const reload = () => questionBankService.list().then(setItems).catch(() => setItems([]));

  useEffect(() => { reload(); }, []);

  const handleDelete = async (item) => {
    try {
      await questionBankService.remove(item.id);
      showToast(t('session.bankDeleted'));
      await reload();
    } catch (err) {
      showToast(err.message || t('common.errorOccurred'), 'error');
    }
  };

  const handleImport = async (imported) => {
    try {
      for (const q of imported) {
        await questionBankService.create(draftToBankRequest({
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex || 0,
          questionType: 'multiple',
          image: '',
          timeLimit: 30,
        }));
      }
      showToast(t('dashboard.importedQuestions', { count: imported.length }));
      await reload();
    } catch (err) {
      showToast(err.message || t('common.errorOccurred'), 'error');
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 ${compact ? 'p-3' : 'p-4 mb-6'}`}>
      {showImport && (
        <Suspense fallback={null}>
          <FileImport onImport={handleImport} onClose={() => setShowImport(false)} />
        </Suspense>
      )}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
          <BookMarked size={16} /> {t('session.bank')}
        </h3>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
        >
          <Upload size={14} /> {t('dashboard.importFromFile')}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{t('session.bankEmpty')}</p>
      ) : (
        <ul className="space-y-2 max-h-56 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{item.text}</span>
              {onPick && (
                <button
                  type="button"
                  onClick={() => onPick(bankItemToDraft(item))}
                  className="px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg"
                >
                  {t('session.addFromBank')}
                </button>
              )}
              <button
                type="button"
                aria-label={t('common.delete')}
                onClick={() => handleDelete(item)}
                className="p-1 text-slate-400 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
