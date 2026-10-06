import { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { Trophy, Users, BarChart3, Download, FileSpreadsheet, FileText, MessageSquare, Cloud } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { voteService } from '../services/voteService';
import { scoreService } from '../services/scoreService';
import { wordcloudService } from '../services/wordcloudService';
import { pollService } from '../services/pollService';
import { CONTENT_TYPES, POLL_TYPE_KEY, QUESTION_TYPE_KEY } from '../config/constants';
import { EntitlementKeys } from '../config/entitlementKeys';
import { useTranslation } from 'react-i18next';
import OpenAnswerList from './OpenAnswerList';
import Leaderboard from './Leaderboard';
import Gate from './Gate';
import { mapPollReport } from '../utils/pollReport';

const WordCloudCanvas = lazy(() => import('./wordcloud/WordCloudCanvas'));

const CHART_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#3B82F6', '#EF4444', '#14B8A6'];

export default function ResultsAnalysis({ poll, pollId, onClose }) {
  const { t } = useTranslation();
  const [aggregates, setAggregates] = useState([]);
  const [openAnswers, setOpenAnswers] = useState([]);
  const [clouds, setClouds] = useState([]);
  const [scores, setScores] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [chartType, setChartType] = useState('bar');

  useEffect(() => {
    if (!pollId || !poll) return undefined;

    let current = true;
    voteService.aggregates(pollId).then((rows) => { if (current) setAggregates(rows); }).catch(() => {});
    voteService.allOpen(pollId).then((rows) => { if (current) setOpenAnswers(rows); }).catch(() => {});
    scoreService.leaderboard(pollId).then((rows) => { if (current) setScores(rows); }).catch(() => {});

    const cloudQuestions = (poll.questions || [])
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => QUESTION_TYPE_KEY[q.questionType] === 'wordcloud');

    if (cloudQuestions.length) {
      Promise.all(cloudQuestions.map(({ q, i }) =>
        wordcloudService.get(pollId, i).then((data) => ({
          questionIndex: i,
          question: q.text,
          terms: data.terms || [],
        }))))
        .then((rows) => { if (current) setClouds(rows); })
        .catch(() => {});
    }

    return () => { current = false; };
  }, [pollId, poll]);

  const typeKey = poll ? POLL_TYPE_KEY[poll.type] : null;
  const typeConfig = typeKey ? CONTENT_TYPES[typeKey] : CONTENT_TYPES.contest;

  const analytics = useMemo(() => {
    if (!poll) return null;
    const questionAnalysis = poll.questions.map((q, i) => {
      const agg = aggregates.find((a) => a.questionIndex === i);
      const total = agg?.totalRespondents || 0;
      const opts = (q.options || []).map((opt, oi) => ({
        text: opt.text,
        votes: agg?.optionCounts?.[oi] || 0,
        percentage: total > 0 ? Math.round(((agg?.optionCounts?.[oi] || 0) / total) * 100) : 0,
        isCorrect: q.correctOptionIndex === oi,
      }));
      return {
        question: q.text,
        questionId: q.id,
        questionType: QUESTION_TYPE_KEY[q.questionType] || 'multiple',
        total,
        options: opts,
      };
    });
    const respondentTotals = questionAnalysis.map((q) => q.total);
    const totalParticipants = respondentTotals.length ? Math.max(...respondentTotals, poll.participantCount || 0) : (poll.participantCount || 0);
    return { totalParticipants, questionAnalysis };
  }, [poll, aggregates]);

  const openByQuestion = useMemo(() => {
    const groups = new Map();
    for (const answer of openAnswers) {
      const list = groups.get(answer.questionId) || [];
      list.push(answer);
      groups.set(answer.questionId, list);
    }
    return groups;
  }, [openAnswers]);

  const reportLabels = {
    user: t('results.pdfUser'),
    score: t('results.pdfScore'),
    time: t('results.pdfTime'),
    sheet: t('results.sheetScores'),
    question: t('results.colQuestion'),
    option: t('results.colOption'),
    votes: t('results.colVotes'),
    percentage: t('results.colPercent'),
    correct: t('results.colCorrect'),
    yes: t('common.yes'),
    no: t('common.no'),
    answer: t('results.colAnswer'),
    term: t('results.colTerm'),
    count: t('results.colCount'),
    selections: t('results.colSelections'),
    sheetQuestions: t('results.sheetQuestions'),
    sheetOpen: t('results.sheetOpen'),
    sheetCloud: t('results.sheetCloud'),
    sheetVotes: t('results.sheetVotes'),
    notMultipleChoice: t('results.notMultipleChoice'),
  };

  const exportReport = async () => import('../utils/scoreReport');

  const loadGatedReport = async () => {
    const report = await pollService.report(pollId);
    return mapPollReport(report, poll);
  };

  const handleExportPdf = async () => {
    try {
      const { scores: rows, extras: gated } = await loadGatedReport();
      const { buildScoreReportPdf, saveScoreReportPdf } = await exportReport();
      saveScoreReportPdf(buildScoreReportPdf(poll.title, rows, reportLabels, gated), poll.title);
    } catch {
      // 402 is raised as the upgrade modal by apiClient.
    }
  };

  const handleExportExcel = async () => {
    try {
      const { scores: rows, extras: gated } = await loadGatedReport();
      const { buildScoreReportWorkbook, saveScoreReportWorkbook } = await exportReport();
      saveScoreReportWorkbook(buildScoreReportWorkbook(rows, reportLabels, gated), poll.title);
    } catch {
      // 402 is raised as the upgrade modal by apiClient.
    }
  };

  const handleExportCsv = async () => {
    try {
      const { scores: rows, extras: gated } = await loadGatedReport();
      const { buildScoreReportCsv, saveScoreReportCsv } = await exportReport();
      saveScoreReportCsv(buildScoreReportCsv(rows, reportLabels, gated), poll.title);
    } catch {
      // 402 is raised as the upgrade modal by apiClient.
    }
  };

  if (!poll) return null;

  const openQuestions = (poll.questions || []).filter((q) => QUESTION_TYPE_KEY[q.questionType] === 'open');
  const hasOpen = openQuestions.length > 0 || openAnswers.length > 0;
  const hasClouds = clouds.length > 0 || (poll.questions || []).some((q) => QUESTION_TYPE_KEY[q.questionType] === 'wordcloud');

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
      <header className="bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-10">
        <h2 className="font-bold text-lg">📊 {t('results.title', { title: poll.title })}</h2>
        <div className="flex gap-2 flex-wrap justify-end">
          <Gate feature={EntitlementKeys.ReportsExport}>
            <button onClick={handleExportCsv} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-1"><Download size={16} /> CSV</button>
            <button onClick={handleExportExcel} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm flex items-center gap-1"><FileSpreadsheet size={16} /> Excel</button>
            <button onClick={handleExportPdf} className="px-3 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-sm flex items-center gap-1"><FileText size={16} /> PDF</button>
          </Gate>
          <button onClick={onClose} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">{t('common.close')}</button>
        </div>
      </header>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}><BarChart3 size={16} className="inline mr-1" /> {t('results.questionsTab')}</button>
          {typeConfig.hasCorrectAnswer && (
            <button onClick={() => setActiveTab('leaderboard')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'leaderboard' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}><Trophy size={16} className="inline mr-1" /> {t('results.leaderboardTab')}</button>
          )}
          {hasOpen && (
            <button onClick={() => setActiveTab('open')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'open' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}><MessageSquare size={16} className="inline mr-1" /> {t('results.openTab', { n: openAnswers.length })}</button>
          )}
          {hasClouds && (
            <button onClick={() => setActiveTab('cloud')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'cloud' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}><Cloud size={16} className="inline mr-1" /> {t('results.cloudTab')}</button>
          )}
          {activeTab === 'overview' && (
            <div className="ml-auto flex gap-2">
              <button onClick={() => setChartType('bar')} className={`px-3 py-2 rounded-lg text-sm ${chartType === 'bar' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}>{t('results.barChart')}</button>
              <button onClick={() => setChartType('pie')} className={`px-3 py-2 rounded-lg text-sm ${chartType === 'pie' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}>{t('results.pieChart')}</button>
            </div>
          )}
        </div>

        {analytics && (
          <div className="bg-white rounded-xl p-4 border border-slate-200 mb-4 flex items-center gap-3">
            <Users className="text-indigo-600" />
            <div>
              <div className="text-2xl font-bold">{analytics.totalParticipants}</div>
              <div className="text-xs text-slate-500">{t('results.totalParticipants')}</div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && analytics && (
          <div className="space-y-4">
            {analytics.questionAnalysis.map((qa, i) => (
              <div key={qa.questionId || i} className="bg-white rounded-xl p-4 border border-slate-200">
                <h3 className="font-bold mb-3">{t('results.questionLabel', { n: i + 1, text: qa.question })}</h3>
                {qa.questionType === 'open' ? (
                  <p className="text-slate-400 italic text-sm">{t('results.seeOpenTab', { n: openByQuestion.get(qa.questionId)?.length || 0 })}</p>
                ) : qa.questionType === 'wordcloud' ? (
                  <p className="text-slate-400 italic text-sm">{t('results.seeCloudTab')}</p>
                ) : qa.options.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(qa.options.length * 40, 160)}>
                    {chartType === 'pie' ? (
                      <PieChart>
                        <Pie data={qa.options} dataKey="votes" nameKey="text" label>
                          {qa.options.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    ) : (
                      <BarChart data={qa.options} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="text" width={140} />
                        <Tooltip />
                        <Bar dataKey="votes">
                          {qa.options.map((o, idx) => (
                            <Cell key={idx} fill={o.isCorrect ? '#10B981' : CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 italic text-sm">{t('results.notMultipleChoice')}</p>
                )}
              </div>
            ))}
            {analytics.questionAnalysis.length === 0 && (
              <p className="text-slate-400 text-center py-8">{t('results.empty')}</p>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <Leaderboard entries={scores} tone="light" />
          </div>
        )}

        {activeTab === 'open' && (
          <div className="space-y-4">
            {openQuestions.length === 0 && openAnswers.length === 0 && (
              <p className="text-slate-400 text-center py-8">{t('presenter.noAnswers')}</p>
            )}
            {(openQuestions.length ? openQuestions : [{ id: null, text: t('results.openAnswers', { n: openAnswers.length }), points: 10 }]).map((q, i) => (
              <div key={q.id || i} className="bg-white rounded-xl p-4 border border-slate-200">
                <h3 className="font-bold mb-3">{q.text}</h3>
                <OpenAnswerList
                  answers={q.id ? (openByQuestion.get(q.id) || []) : openAnswers}
                  maxPoints={q.points || 10}
                  tone="light"
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'cloud' && (
          <div className="space-y-4">
            {clouds.length === 0 && <p className="text-slate-400 text-center py-8">{t('results.noCloud')}</p>}
            {clouds.map((cloud) => (
              <div key={cloud.questionIndex} className="bg-white rounded-xl p-4 border border-slate-200">
                <h3 className="font-bold mb-3">{cloud.question}</h3>
                {cloud.terms.length === 0 ? (
                  <p className="text-slate-400 italic text-sm">{t('presenter.noJoin')}</p>
                ) : (
                  <div className="h-[320px]">
                    <Suspense fallback={null}>
                      <WordCloudCanvas terms={cloud.terms} width={900} height={320} />
                    </Suspense>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
