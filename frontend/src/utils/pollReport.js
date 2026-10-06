import { QUESTION_TYPE_KEY } from '../config/constants';

function optionText(question, index) {
  return question?.options?.[index]?.text ?? `#${index + 1}`;
}

/**
 * Maps the owner-only GET /api/polls/{id}/report payload onto the extras
 * shape scoreReport.js already consumes. The analysis screen still loads
 * charts from the public/paged endpoints; only the export buttons go through
 * this so a missing reports.export feature is a 402 rather than a silent
 * client-side zip of data the caller already had.
 */
export function mapPollReport(report, poll) {
  const questions = poll?.questions || [];
  const questionsById = Object.fromEntries(questions.map((q) => [q.id, q]));
  const aggregates = report?.aggregates || [];

  const questionAnalysis = questions.map((q, i) => {
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

  return {
    scores: report?.scores || [],
    extras: {
      questions: questionAnalysis,
      openAnswers: (report?.openAnswers || []).map((a) => ({
        question: questionsById[a.questionId]?.text || a.questionId,
        userName: a.userName,
        answerText: a.answerText,
        score: a.score,
      })),
      wordClouds: (report?.wordClouds || []).map((c) => ({
        questionIndex: c.questionIndex,
        question: c.questionText,
        terms: c.terms || [],
      })),
      votes: (report?.votes || []).map((v) => ({
        userName: v.userName,
        question: questionsById[v.questionId]?.text || v.questionId,
        selections: (v.selectedIndices || []).map((i) => optionText(questionsById[v.questionId], i)),
        isCorrect: v.isCorrect,
        responseTimeMs: v.responseTimeMs,
      })),
    },
  };
}
