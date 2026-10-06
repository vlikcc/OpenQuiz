// Mirrors OpenQuiz.Application.Billing.EntitlementKeys on the backend — keep
// these in sync by hand; there is no shared schema between the two stacks.
export const EntitlementKeys = {
  ReportsExport: 'reports.export',
  ReportsAdvanced: 'reports.advanced',
  BrandingCustom: 'branding.custom',
  ContentExam: 'content.exam',
  ContentWordCloud: 'content.wordcloud',
  ContentKatex: 'content.katex',

  LimitActivePolls: 'limits.activePolls',
  LimitParticipantsPerSession: 'limits.participantsPerSession',
  LimitSessionsPerMonth: 'limits.sessionsPerMonth',
  LimitQuestionsPerPoll: 'limits.questionsPerPoll',

  Unlimited: -1,
};
