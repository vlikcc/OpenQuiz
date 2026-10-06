import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CheckCircle2, XCircle, Loader2, Send, TimerOff } from 'lucide-react';
import { CONTENT_TYPES, POLL_TYPE_KEY, POLL_STATUS_KEY, QUESTION_TYPE_KEY } from '../config/constants';
import { pollService } from '../services/pollService';
import { voteService } from '../services/voteService';
import { wordcloudService } from '../services/wordcloudService';
import { reactionService } from '../services/reactionService';
import { realtimeService } from '../services/realtimeService';
import { brandingService } from '../services/brandingService';
import { useTranslation } from 'react-i18next';
import KatexText from './KatexText';
import WaitingRoom from './WaitingRoom';
import WordCloudVoter from './wordcloud/WordCloudVoter';
import { clockOffsetMs, deadlineFor, secondsLeft } from '../utils/questionClock';
import { mediaUrl } from '../utils/mediaUrl';

export default function VoterMode({ pollId, showToast, preloadedPoll = null }) {
  const { t } = useTranslation();
  const [step, setStep] = useState('name');
  const [userName, setUserName] = useState(() => localStorage.getItem('voterName') ?? '');
  const [poll, setPoll] = useState(preloadedPoll);
  const [currentQIndex, setCurrentQIndex] = useState(preloadedPoll?.currentQuestionIndex ?? 0);
  const [hasVotedForCurrent, setHasVotedForCurrent] = useState(false);
  const [startTime, setStartTime] = useState(() => Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [openAnswer, setOpenAnswer] = useState('');
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [isRegistered, setIsRegistered] = useState(false);
  const [branding, setBranding] = useState(null);
  // The server decides when a question closes; this only tracks how far the
  // local clock is from the server's so the countdown agrees with that decision.
  const [clockOffset, setClockOffset] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const votedQuestionsRef = useRef(new Set());
  const wordCloudDraftRef = useRef([]);
  // The SignalR subscription below is created once per poll, so its handler
  // cannot read `currentQIndex` from state without capturing a stale value.
  const currentQIndexRef = useRef(currentQIndex);

  const goToQuestion = useCallback((index) => {
    currentQIndexRef.current = index;
    setCurrentQIndex(index);
  }, []);

  const ct = (key) => t(`contentTypes.${key}.label`);

  // Initial load + SignalR subscription
  useEffect(() => {
    if (!pollId) return;
    let active = true;

    pollService.get(pollId).then((p) => {
      if (active && p) {
        setPoll(p);
        setClockOffset(clockOffsetMs(p));
        goToQuestion(p.currentQuestionIndex ?? 0);
      }
    }).catch(console.error);

    brandingService.getForPoll(pollId).then((row) => {
      if (active) setBranding(row);
    }).catch(() => {});

    const unsubP = realtimeService.subscribe(pollId, {
      onPollUpdated: (p) => {
        if (!active) return;
        setPoll(p);
        setClockOffset(clockOffsetMs(p));
        const newQ = p.currentQuestionIndex ?? 0;
        if (newQ !== currentQIndexRef.current) {
          goToQuestion(newQ);
          const key = `${pollId}_${newQ}`;
          const voted = votedQuestionsRef.current.has(key);
          setHasVotedForCurrent(voted);
          if (!voted) {
            setLastResult(null);
            setStartTime(Date.now());
            setOpenAnswer('');
            setSelectedIndices([]);
            wordCloudDraftRef.current = [];
          }
        }
      },
    });

    return () => { active = false; unsubP.then((u) => u && u()); };
  }, [pollId, goToQuestion]);

  const activeQuestion = poll?.questions?.[currentQIndex];
  const deadline = useMemo(
    () => deadlineFor(poll, activeQuestion, clockOffset),
    [poll, activeQuestion, clockOffset],
  );
  const timeLeft = secondsLeft(deadline, nowMs);

  useEffect(() => {
    if (deadline === null || hasVotedForCurrent) return undefined;

    // Faster than once a second so the bar does not visibly stall, and so the
    // hand-off to the auto-submit below happens close to the real deadline.
    const interval = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(interval);
  }, [deadline, hasVotedForCurrent]);

  const handleStart = useCallback(async (e) => {
    e.preventDefault();
    if (!userName.trim()) return;
    localStorage.setItem('voterName', userName);
    if (!isRegistered) {
      try { await pollService.join(pollId, userName); setIsRegistered(true); }
      catch (err) { console.warn('join failed', err); }
    }
    setStep('vote');
  }, [userName, pollId, isRegistered]);

  const submitVote = useCallback(async (indices) => {
    setIsSubmitting(true);
    const typeKey = POLL_TYPE_KEY[poll.type] || 'contest';
    const typeCfg = CONTENT_TYPES[typeKey] || CONTENT_TYPES.contest;

    try {
      const result = await voteService.submit(pollId, {
        questionIndex: currentQIndex,
        selectedIndices: indices,
        responseTimeMs: Date.now() - startTime,
        userName,
      });
      const key = `${pollId}_${currentQIndex}`;
      votedQuestionsRef.current.add(key);
      setHasVotedForCurrent(true);
      setLastResult(typeCfg.hasCorrectAnswer ? (result.isCorrect ? 'correct' : 'wrong') : 'voted');
    } catch (err) {
      showToast(err.message || t('voter.voteFailed'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [poll, pollId, currentQIndex, startTime, userName, showToast, t]);

  const handleVote = useCallback((optionIndex) => {
    const q = poll.questions[currentQIndex];
    if (q.allowMultiple) {
      if (hasVotedForCurrent) return;
      setSelectedIndices((p) => p.includes(optionIndex) ? p.filter((i) => i !== optionIndex) : [...p, optionIndex]);
      return;
    }
    if (isSubmitting || hasVotedForCurrent) return;
    submitVote([optionIndex]);
  }, [poll, currentQIndex, isSubmitting, hasVotedForCurrent, submitVote]);

  const handleSubmitMulti = () => {
    if (selectedIndices.length === 0 || isSubmitting || hasVotedForCurrent) return;
    submitVote(selectedIndices);
  };

  const handleOpenAnswer = useCallback(async () => {
    if (isSubmitting || hasVotedForCurrent || !openAnswer.trim()) return;
    setIsSubmitting(true);
    try {
      await voteService.submitOpen(pollId, { questionIndex: currentQIndex, answerText: openAnswer.trim(), userName });
      votedQuestionsRef.current.add(`${pollId}_${currentQIndex}`);
      setHasVotedForCurrent(true);
      setLastResult('submitted');
      setOpenAnswer('');
    } catch (err) {
      showToast(err.message || t('voter.answerFailed'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, hasVotedForCurrent, openAnswer, pollId, currentQIndex, userName, showToast, t]);

  const handleWordCloudSubmit = useCallback(async (terms) => {
    setIsSubmitting(true);
    try {
      await wordcloudService.submit(pollId, { questionIndex: currentQIndex, terms, userName });
      votedQuestionsRef.current.add(`${pollId}_${currentQIndex}`);
      setHasVotedForCurrent(true);
      setLastResult('submitted');
    } catch (err) {
      showToast(err.message || t('voter.submitFailed'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [pollId, currentQIndex, userName, showToast, t]);

  const noteWordCloudDraft = useCallback((terms) => { wordCloudDraftRef.current = terms; }, []);

  /**
   * The server stops accepting answers the moment the question's time is up, so
   * whatever the participant had entered is sent for them rather than lost. With
   * nothing entered the question simply closes.
   */
  const handleExpiry = useCallback(() => {
    const question = poll?.questions?.[currentQIndex];
    const questionType = question ? QUESTION_TYPE_KEY[question.questionType] : null;

    if (questionType === 'open' && openAnswer.trim()) return handleOpenAnswer();
    if (questionType === 'wordcloud' && wordCloudDraftRef.current.length > 0) {
      return handleWordCloudSubmit(wordCloudDraftRef.current);
    }
    if (questionType !== 'open' && questionType !== 'wordcloud' && selectedIndices.length > 0) {
      return submitVote(selectedIndices);
    }

    votedQuestionsRef.current.add(`${pollId}_${currentQIndex}`);
    setHasVotedForCurrent(true);
    setLastResult('timeout');
    return undefined;
  }, [poll, currentQIndex, openAnswer, selectedIndices, pollId, handleOpenAnswer, handleWordCloudSubmit, submitVote]);

  const expired = timeLeft === 0;
  const handledExpiryRef = useRef(null);

  useEffect(() => {
    const key = `${pollId}_${currentQIndex}`;
    if (!expired || hasVotedForCurrent || isSubmitting || handledExpiryRef.current === key) return;

    handledExpiryRef.current = key;
    handleExpiry();
  }, [expired, hasVotedForCurrent, isSubmitting, pollId, currentQIndex, handleExpiry]);

  const handleReaction = (emoji) => reactionService.send(pollId, emoji, userName).catch(() => {});

  if (!poll) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  const statusKey = POLL_STATUS_KEY[poll.status] || 'live';
  if (step === 'vote' && statusKey === 'waiting') {
    return <WaitingRoom poll={poll} participantCount={poll.participantCount || 0} userName={userName} branding={branding} />;
  }

  if (step === 'name') {
    const typeKey = POLL_TYPE_KEY[poll.type] || 'contest';
    const typeCfg = CONTENT_TYPES[typeKey] || CONTENT_TYPES.contest;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white max-w-sm w-full p-8 rounded-3xl shadow-xl text-center">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="h-16 w-16 object-contain mx-auto mb-4" />
          ) : (
            <div className="text-5xl mb-4">{typeCfg.icon}</div>
          )}
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-4 ${typeCfg.classes.badge}`}>{ct(typeKey)}</span>
          <h2 className="text-2xl font-bold mb-2">{poll.title}</h2>
          {branding?.joinMessage && <p className="text-slate-500 text-sm mb-4">{branding.joinMessage}</p>}
          <p className="text-slate-500 text-sm mb-6">{poll.questions?.length || 0} {t('common.question')}</p>
          <form onSubmit={handleStart}>
            <label htmlFor="voter-name" className="block text-sm font-medium text-slate-600 mb-2">{t('voter.yourName')}</label>
            <input id="voter-name" type="text" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full p-4 border-2 border-slate-200 rounded-xl mb-4 text-center font-bold text-lg focus:border-indigo-500 outline-none" placeholder={t('voter.yourName')} required />
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg">{t('voter.join')}</button>
          </form>
          {!branding?.hideOpenQuizBranding && (
            <p className="mt-6 text-xs text-slate-400">{t('waiting.poweredBy')}</p>
          )}
        </div>
      </div>
    );
  }

  if (hasVotedForCurrent) {
    if (lastResult === 'timeout') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white text-center bg-slate-600">
          <div className="bg-white/20 backdrop-blur-md p-10 rounded-3xl shadow-2xl">
            <TimerOff size={64} className="mx-auto mb-4" />
            <h2 className="text-4xl font-black mb-2">{t('voter.timeUp')}</h2>
            <div className="flex items-center justify-center gap-2 bg-black/20 px-4 py-2 rounded-full text-sm font-medium animate-pulse">
              <Loader2 size={16} className="animate-spin" /> {t('voter.waitingForNext')}
            </div>
          </div>
        </div>
      );
    }
    if (lastResult === 'voted' || lastResult === 'submitted') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white text-center bg-indigo-500">
          <div className="bg-white/20 backdrop-blur-md p-10 rounded-3xl shadow-2xl">
            <CheckCircle2 size={64} className="mx-auto mb-4" />
            <h2 className="text-4xl font-black mb-2">{lastResult === 'submitted' ? t('voter.sent') : t('voter.thankYou')}</h2>
            <div className="flex items-center justify-center gap-2 bg-black/20 px-4 py-2 rounded-full text-sm font-medium animate-pulse">
              <Loader2 size={16} className="animate-spin" /> {t('voter.waitingForNext')}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-white text-center ${lastResult === 'correct' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
        <div className="bg-white/20 backdrop-blur-md p-10 rounded-3xl shadow-2xl">
          {lastResult === 'correct' ? <CheckCircle2 size={64} className="mx-auto mb-4" /> : <XCircle size={64} className="mx-auto mb-4" />}
          <h2 className="text-4xl font-black mb-2">{lastResult === 'correct' ? t('voter.correct') : t('voter.wrong')}</h2>
          <div className="flex items-center justify-center gap-2 bg-black/20 px-4 py-2 rounded-full text-sm font-medium animate-pulse">
            <Loader2 size={16} className="animate-spin" /> {t('voter.waitingForPresenter')}
          </div>
        </div>
      </div>
    );
  }

  const q = poll.questions[currentQIndex];
  if (!q) return <div className="h-screen flex items-center justify-center">{t('voter.ended')}</div>;

  const typeKey = POLL_TYPE_KEY[poll.type] || 'contest';
  const isExam = typeKey === 'exam';
  const qTypeKey = QUESTION_TYPE_KEY[q.questionType] || 'multiple';
  const isOpen = qTypeKey === 'open';
  const isWordCloud = qTypeKey === 'wordcloud';

  return (
    <div className="h-full bg-slate-50 flex flex-col w-full max-w-2xl mx-auto overflow-hidden">
      <div className="p-4 sm:p-6 shrink-0 z-10 bg-slate-50">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-bold ${isExam ? 'bg-rose-100 text-rose-700' : isWordCloud ? 'bg-sky-100 text-sky-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {t('voter.question')} {currentQIndex + 1}
            </span>
            {isOpen && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">{t('voter.open')}</span>}
            {isWordCloud && <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded text-[10px] font-bold">{t('voter.wordCloud')}</span>}
            {isExam && q.points && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">{t('voter.points', { n: q.points })}</span>}
          </div>
          <span className="text-red-500 text-xs font-bold animate-pulse">{t('common.live')}</span>
        </div>

        <div className="text-lg sm:text-xl font-bold text-slate-900">
          {q.imageUrl && (<div className="mb-4"><img src={mediaUrl(q.imageUrl)} alt={q.text} className="max-h-48 rounded-lg shadow-sm mx-auto object-contain" /></div>)}
          {isExam && q.text.includes('$') ? <KatexText text={q.text} /> : q.text}
        </div>

        {!hasVotedForCurrent && timeLeft !== null && (
          <div className="mt-4">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ease-linear ${timeLeft < 10 ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${Math.min(100, (timeLeft / q.timeLimit) * 100)}%` }}
              />
            </div>
            <div className={`mt-1 text-right text-xs font-bold ${timeLeft < 10 ? 'text-red-500' : 'text-slate-400'}`}>
              {t('voter.secondsLeft', { n: timeLeft })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 sm:p-6 space-y-2 overflow-y-auto custom-scrollbar">
        {isWordCloud ? (
          <WordCloudVoter maxWords={q.maxWords || 3} isSubmitting={isSubmitting} onSubmit={handleWordCloudSubmit} onDraftChange={noteWordCloudDraft} />
        ) : isOpen ? (
          <div className="space-y-4">
            <textarea
              value={openAnswer}
              onChange={(e) => setOpenAnswer(e.target.value)}
              placeholder={t('voter.yourAnswer')}
              rows={6}
              className="w-full p-4 rounded-xl border-2 border-slate-200 bg-white text-base text-slate-700 focus:border-rose-400 outline-none resize-none"
            />
            <button onClick={handleOpenAnswer} disabled={isSubmitting || !openAnswer.trim()} className="w-full py-4 bg-rose-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              {t('voter.submitAnswer')}
            </button>
          </div>
        ) : (
          (q.options || []).map((opt, idx) => (
            <button
              key={opt.id || idx}
              onClick={() => handleVote(idx)}
              disabled={isSubmitting || (hasVotedForCurrent && !q.allowMultiple)}
              className={`w-full p-3 sm:p-4 rounded-xl border-2 text-left font-bold text-base sm:text-lg transition-all ${
                selectedIndices.includes(idx)
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-500'
              }`}
            >
              {isExam && opt.text.includes('$') ? <KatexText text={opt.text} /> : opt.text}
            </button>
          ))
        )}

        {q.allowMultiple && !hasVotedForCurrent && !isOpen && !isWordCloud && (
          <button onClick={handleSubmitMulti} disabled={selectedIndices.length === 0 || isSubmitting} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 mt-4">
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            {t('voter.submitSelections', { n: selectedIndices.length })}
          </button>
        )}
      </div>

      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-40">
        {['❤️', '👍', '🎉', '😂'].map((e) => (
          <button key={e} onClick={() => handleReaction(e)} className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform border border-slate-100">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
