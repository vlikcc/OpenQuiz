import { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pollService } from '../services/pollService';
import LoadingPanel from './LoadingPanel';

const ResultsAnalysis = lazy(() => import('./ResultsAnalysis'));

export default function ResultsShareScreen({ token, onClose }) {
  const { t } = useTranslation();
  const [poll, setPoll] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let current = true;
    pollService.getShared(token)
      .then((row) => { if (current) setPoll(row); })
      .catch(() => { if (current) setMissing(true); });
    return () => { current = false; };
  }, [token]);

  if (missing) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 p-8 text-center">
        <p className="text-slate-600">{t('session.resultsUnavailable')}</p>
      </div>
    );
  }

  if (!poll) return <LoadingPanel />;

  return (
    <Suspense fallback={<LoadingPanel />}>
      <ResultsAnalysis poll={poll} pollId={poll.id} onClose={onClose} />
    </Suspense>
  );
}
