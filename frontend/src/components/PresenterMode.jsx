import { Suspense, lazy, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { Home, QrCode, Users, Loader2, ChevronRight, ChevronLeft, BarChart3, MessageSquare, Play, Square, Trophy } from 'lucide-react';
import { COLORS, CONTENT_TYPES, POLL_TYPE_KEY, POLL_STATUS_KEY, QUESTION_TYPE_KEY } from '../config/constants';
import { pollService } from '../services/pollService';
import { voteService } from '../services/voteService';
import { wordcloudService } from '../services/wordcloudService';
import { scoreService } from '../services/scoreService';
import { reactionService } from '../services/reactionService';
import { realtimeService } from '../services/realtimeService';
import { useTranslation } from 'react-i18next';
import QrModal from './QrModal';
import KatexText from './KatexText';
import { mediaUrl } from '../utils/mediaUrl';
import OpenAnswerList from './OpenAnswerList';
import Leaderboard from './Leaderboard';
import { mergeAnswerKey } from '../utils/pollAnswers';

// d3's layout solver is only needed by word cloud questions.
const WordCloudCanvas = lazy(() => import('./wordcloud/WordCloudCanvas'));

// What the wall has room for, and what the hub sends after a scored answer.
const LEADERBOARD_SIZE = 10;

/** Keeps the running totals in step with the bursts arriving from the hub. */
function bumpTally(tally, emoji) {
  const index = tally.findIndex((t) => t.emoji === emoji);
  if (index < 0) return [...tally, { emoji, count: 1 }];

  const next = [...tally];
  next[index] = { emoji, count: next[index].count + 1 };
  return next;
}

export default function PresenterMode({ pollId, onExit, showToast }) {
  const { t } = useTranslation();
  const [poll, setPoll] = useState(null);
  const [aggregates, setAggregates] = useState([]);
  const [openAnswers, setOpenAnswers] = useState([]);
  const [wordCloud, setWordCloud] = useState({ questionIndex: 0, terms: [] });
  const [scores, setScores] = useState([]);
  const [showQr, setShowQr] = useState(false);
  // A tab the presenter picked, remembered only for as long as the session is
  // in the same state — so ending a contest brings up the standings on its own.
  const [tabChoice, setTabChoice] = useState(null);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [reactionTally, setReactionTally] = useState([]);
  const reactionIdRef = useRef(0);

  const ct = (key) => t(`contentTypes.${key}.label`);

  // Answers arrive one per participant, so a burst is the normal case. The list
  // is reloaded once shortly after the flurry rather than once per answer.
  const openAnswerReloadRef = useRef(null);
  const scheduleOpenAnswerReload = useCallback(() => {
    if (openAnswerReloadRef.current) return;
    openAnswerReloadRef.current = setTimeout(() => {
      openAnswerReloadRef.current = null;
      voteService.allOpen(pollId).then(setOpenAnswers).catch(() => {});
    }, 800);
  }, [pollId]);

  useEffect(() => {
    if (!pollId) return;
    let active = true;
    pollService.get(pollId).then((p) => { if (active) setPoll(p); }).catch((e) => showToast(e.message, 'error'));
    reactionService.tally(pollId).then((t) => { if (active) setReactionTally(t); }).catch(() => {});

    const unsubPromise = realtimeService.subscribe(pollId, {
      onPollUpdated: (p) => { if (active) setPoll((prev) => mergeAnswerKey(p, prev)); },
      onVoteCountsUpdated: (agg) => {
        if (!active) return;
        setAggregates((prev) => {
          const next = [...prev];
          const idx = next.findIndex((a) => a.questionIndex === agg.questionIndex);
          if (idx >= 0) next[idx] = agg; else next.push(agg);
          return next;
        });
      },
      onWordCloudUpdated: (payload) => { if (active) setWordCloud(payload); },
      onOpenAnswerSubmitted: () => { if (active) scheduleOpenAnswerReload(); },
      onLeaderboardUpdated: (payload) => { if (active) setScores(payload.entries || []); },
      onReaction: (r) => {
        if (!active) return;
        const id = ++reactionIdRef.current;
        const x = Math.random() * 80 + 10;
        setFloatingReactions((prev) => [...prev, { id, emoji: r.emoji, x }]);
        setTimeout(() => setFloatingReactions((prev) => prev.filter((f) => f.id !== id)), 3000);
        setReactionTally((prev) => bumpTally(prev, r.emoji));
      },
    });

    return () => {
      active = false;
      unsubPromise.then((u) => u && u());
      if (openAnswerReloadRef.current) clearTimeout(openAnswerReloadRef.current);
    };
  }, [pollId, scheduleOpenAnswerReload]);

  // Only contests, quizzes and exams keep points, so only they have standings.
  const statusKey = poll ? (POLL_STATUS_KEY[poll.status] || 'waiting') : 'waiting';
  const typeKey = poll ? (POLL_TYPE_KEY[poll.type] || 'contest') : 'contest';
  const typeCfg = CONTENT_TYPES[typeKey] || CONTENT_TYPES.contest;
  const hasScores = typeCfg.hasCorrectAnswer;

  // The hub pushes the standings after every scored answer; this is the first
  // draw, and the redraw for a presenter who opens a session already in play.
  useEffect(() => {
    if (!pollId || !hasScores) return;
    scoreService.leaderboard(pollId, LEADERBOARD_SIZE).then(setScores).catch(() => {});
  }, [pollId, hasScores, statusKey]);

  // Refresh aggregates / open answers / wordcloud when question changes
  useEffect(() => {
    if (!poll) return;
    voteService.aggregates(pollId).then(setAggregates).catch(() => {});
    const q = poll.questions?.[poll.currentQuestionIndex || 0];
    if (!q) return;
    const qt = QUESTION_TYPE_KEY[q.questionType];
    if (qt === 'open') voteService.allOpen(pollId).then(setOpenAnswers).catch(() => {});
    if (qt === 'wordcloud') wordcloudService.get(pollId, poll.currentQuestionIndex || 0).then(setWordCloud).catch(() => {});
  }, [poll?.currentQuestionIndex, poll?.id]);

  const currentQ = poll?.questions?.[poll.currentQuestionIndex || 0];
  const currentAggregate = useMemo(
    () => aggregates.find((a) => a.questionIndex === (poll?.currentQuestionIndex || 0)),
    [aggregates, poll?.currentQuestionIndex],
  );

  const chartData = useMemo(() => {
    if (!currentQ || !currentAggregate || !currentQ.options) return [];
    return currentQ.options.map((opt, i) => ({
      name: opt.text,
      votes: currentAggregate.optionCounts?.[i] || 0,
      isCorrect: currentQ.correctOptionIndex === i,
      fill: COLORS[i % COLORS.length],
    }));
  }, [currentQ, currentAggregate]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (statusKey !== 'live') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        pollService.prevQuestion(pollId).then(setPoll).catch((err) => showToast(err.message, 'error'));
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        pollService.nextQuestion(pollId).then(setPoll).catch((err) => showToast(err.message, 'error'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [statusKey, pollId, showToast]);

  if (!poll) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  const qTypeKey = currentQ ? (QUESTION_TYPE_KEY[currentQ.questionType] || 'multiple') : 'multiple';
  const isWordCloud = qTypeKey === 'wordcloud';
  const isOpen = qTypeKey === 'open';

  const activeTab = tabChoice?.status === statusKey
    ? tabChoice.tab
    : (statusKey === 'ended' && hasScores ? 'leaderboard' : 'chart');
  const chooseTab = (tab) => setTabChoice({ status: statusKey, tab });

  const handleScoreAnswer = async (answer, score) => {
    try {
      const graded = await voteService.scoreOpen(pollId, answer.id, score);
      setOpenAnswers((prev) => prev.map((a) => (a.id === graded.id ? graded : a)));
      showToast(t('grading.saved'));
    } catch (e) {
      showToast(e.message, 'error');
      throw e;
    }
  };

  const handleActivate = async () => { try { setPoll(await pollService.activate(pollId)); showToast(t('presenter.started')); } catch (e) { showToast(e.message, 'error'); } };
  const handleNext = async () => { try { setPoll(await pollService.nextQuestion(pollId)); } catch (e) { showToast(e.message, 'error'); } };
  const handlePrev = async () => { try { setPoll(await pollService.prevQuestion(pollId)); } catch (e) { showToast(e.message, 'error'); } };
  const handleEnd = async () => { try { setPoll(await pollService.end(pollId)); showToast(t('presenter.ended')); } catch (e) { showToast(e.message, 'error'); } };

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-slate-900 to-indigo-900 text-white overflow-hidden">
      {showQr && <QrModal pollId={pollId} title={poll.title} joinCode={poll.joinCode} onClose={() => setShowQr(false)} />}

      <header className="flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onExit} aria-label={t('common.back')} className="p-2 hover:bg-white/10 rounded-lg"><Home size={20} /></button>
          <div>
            <h1 className="font-bold">{poll.title}</h1>
            <p className="text-xs text-white/70">{typeCfg.icon} {ct(typeKey)}</p>
          </div>
          {poll.joinCode && (
            <span className="font-mono tracking-[0.2em] text-lg font-black bg-white/10 px-3 py-1 rounded-lg">
              {poll.joinCode}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {reactionTally.length > 0 && (
            <span className="hidden sm:flex items-center gap-2 px-3 py-1 text-xs bg-white/10 rounded-full" title={t('presenter.reactions')}>
              {reactionTally.slice(0, 4).map((r) => (
                <span key={r.emoji}>{r.emoji} {r.count}</span>
              ))}
            </span>
          )}
          <span className="px-3 py-1 text-xs bg-white/10 rounded-full" aria-live="polite">
            <Users size={14} className="inline -mt-0.5" /> {poll.participantCount}
          </span>
          <button onClick={() => setShowQr(true)} aria-label={t('dashboard.showQr')} className="px-3 py-1.5 text-sm bg-indigo-500 hover:bg-indigo-600 rounded-lg flex items-center gap-1"><QrCode size={14} /> QR</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {statusKey === 'waiting' && (
          <div className="max-w-2xl mx-auto text-center p-10">
            <h2 className="text-3xl font-bold mb-4">{t('presenter.waitingRoomTitle')}</h2>
            {poll.joinCode && (
              <p className="font-mono tracking-[0.35em] text-5xl sm:text-6xl font-black mb-6">{poll.joinCode}</p>
            )}
            <p className="text-white/70 mb-6" aria-live="polite">{t('presenter.peopleJoined', { count: poll.participantCount || 0 })}</p>
            <button onClick={handleActivate} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold flex items-center gap-2 mx-auto"><Play size={20} /> {t('presenter.startContest')}</button>
          </div>
        )}

        {statusKey !== 'waiting' && currentQ && (
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <div className="text-sm text-white/70 mb-2">{t('presenter.questionOf', { current: (poll.currentQuestionIndex || 0) + 1, total: poll.questions.length })}</div>
              <h2 className="text-3xl font-bold">
                {typeKey === 'exam' && currentQ.text.includes('$') ? <KatexText text={currentQ.text} /> : currentQ.text}
              </h2>
              {/* A question whose picture only reached the phones was half a question. */}
              {currentQ.imageUrl && (
                <img
                  src={mediaUrl(currentQ.imageUrl)}
                  alt={currentQ.text}
                  className="mt-4 max-h-64 rounded-xl shadow-lg object-contain bg-black/20"
                />
              )}
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={() => chooseTab('chart')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'chart' ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}><BarChart3 size={16} className="inline mr-1" /> {t('presenter.results')}</button>
              {isOpen && <button onClick={() => chooseTab('open')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'open' ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}><MessageSquare size={16} className="inline mr-1" /> {t('presenter.answers', { n: openAnswers.length })}</button>}
              {hasScores && <button onClick={() => chooseTab('leaderboard')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'leaderboard' ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}><Trophy size={16} className="inline mr-1" /> {t('presenter.leaderboard')}</button>}
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 min-h-[400px]">
              {activeTab === 'leaderboard' ? (
                <Leaderboard entries={scores} />
              ) : isWordCloud ? (
                <div className="h-[400px]">
                  <Suspense fallback={null}>
                    <WordCloudCanvas terms={wordCloud.terms} width={1000} height={400} />
                  </Suspense>
                </div>
              ) : isOpen && activeTab === 'open' ? (
                <OpenAnswerList
                  answers={openAnswers.filter((a) => a.questionId === currentQ.id)}
                  maxPoints={currentQ.points || 10}
                  onScore={handleScoreAnswer}
                />
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                    <XAxis dataKey="name" stroke="#ffffff80" />
                    <Bar dataKey="votes" radius={[8, 8, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.isCorrect ? '#10B981' : entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={handlePrev} aria-label={t('presenter.prev')} disabled={(poll.currentQuestionIndex || 0) === 0} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-30 flex items-center gap-1"><ChevronLeft size={16} /> {t('presenter.prev')}</button>
              {statusKey === 'live' ? (
                <button onClick={handleNext} aria-label={t('presenter.next')} className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-bold flex items-center gap-2">
                  {(poll.currentQuestionIndex || 0) === poll.questions.length - 1 ? t('presenter.end') : t('presenter.next')} <ChevronRight size={16} />
                </button>
              ) : (
                <button onClick={onExit} className="px-6 py-3 bg-slate-600 hover:bg-slate-700 rounded-lg font-bold">{t('presenter.doneBack')}</button>
              )}
              {statusKey === 'live' && <button onClick={handleEnd} aria-label={t('presenter.endButton')} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1"><Square size={14} /> {t('presenter.endButton')}</button>}
            </div>
          </div>
        )}
      </div>

      {/* Floating reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floatingReactions.map((r) => (
          <div key={r.id} className="absolute text-4xl animate-bounce" style={{ left: `${r.x}%`, bottom: '0', animation: 'floatUp 3s ease-out forwards' }}>
            {r.emoji}
          </div>
        ))}
      </div>
    </div>
  );
}
