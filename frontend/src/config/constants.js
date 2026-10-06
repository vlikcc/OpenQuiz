export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
// Optional; when empty the contact screen still copies a request, it just
// has no mailto target. Set this in the cloud image, not in self-host defaults.
export const BILLING_CONTACT_EMAIL = import.meta.env.VITE_BILLING_CONTACT_EMAIL || '';

export const COLORS = ['#4F46E5', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#3B82F6'];

// Maps to backend OpenQuiz.Domain.Enums.PollType (numeric).
export const POLL_TYPE_VALUE = {
  contest: 1,
  survey: 2,
  quiz: 3,
  exam: 4,
  wordcloud: 5,
};

export const POLL_TYPE_KEY = Object.fromEntries(
  Object.entries(POLL_TYPE_VALUE).map(([k, v]) => [v, k]),
);

// Maps to backend OpenQuiz.Domain.Enums.QuestionType.
export const QUESTION_TYPE_VALUE = {
  multiple: 1,
  open: 2,
  wordcloud: 3,
};

export const QUESTION_TYPE_KEY = Object.fromEntries(
  Object.entries(QUESTION_TYPE_VALUE).map(([k, v]) => [v, k]),
);

export const POLL_STATUS_VALUE = { waiting: 1, live: 2, ended: 3 };
export const POLL_STATUS_KEY = Object.fromEntries(
  Object.entries(POLL_STATUS_VALUE).map(([k, v]) => [v, k]),
);

// Tailwind's JIT compiler only emits classes it can find as complete literals in
// the source, so per-type colors must be written out instead of interpolated.
const TYPE_CLASSES = {
  indigo: {
    solid: 'bg-indigo-600 hover:bg-indigo-700',
    soft: 'bg-indigo-50 text-indigo-700',
    badge: 'bg-indigo-100 text-indigo-700',
  },
  emerald: {
    solid: 'bg-emerald-600 hover:bg-emerald-700',
    soft: 'bg-emerald-50 text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  amber: {
    solid: 'bg-amber-600 hover:bg-amber-700',
    soft: 'bg-amber-50 text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  rose: {
    solid: 'bg-rose-600 hover:bg-rose-700',
    soft: 'bg-rose-50 text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
  },
  sky: {
    solid: 'bg-sky-600 hover:bg-sky-700',
    soft: 'bg-sky-50 text-sky-700',
    badge: 'bg-sky-100 text-sky-700',
  },
};

export const CONTENT_TYPES = {
  contest: {
    label: 'Yarışma',
    icon: '🏆',
    color: 'indigo',
    classes: TYPE_CLASSES.indigo,
    description: 'Doğru cevaplı sorular, puanlama sistemi',
    hasCorrectAnswer: true,
    multipleQuestions: true,
    questionType: 'multiple',
  },
  survey: {
    label: 'Anket',
    icon: '📊',
    color: 'emerald',
    classes: TYPE_CLASSES.emerald,
    description: 'Fikir toplama, doğru cevap yok',
    hasCorrectAnswer: false,
    multipleQuestions: true,
    questionType: 'multiple',
  },
  quiz: {
    label: 'Quiz',
    icon: '❓',
    color: 'amber',
    classes: TYPE_CLASSES.amber,
    description: 'Tek sorulu hızlı test',
    hasCorrectAnswer: true,
    multipleQuestions: true,
    questionType: 'multiple',
  },
  exam: {
    label: 'Sınav',
    icon: '📝',
    color: 'rose',
    classes: TYPE_CLASSES.rose,
    description: 'Çoktan seçmeli ve açık uçlu sorular, KaTeX formül desteği',
    hasCorrectAnswer: true,
    multipleQuestions: true,
    questionType: 'mixed',
    supportsKatex: true,
  },
  wordcloud: {
    label: 'Kelime Bulutu',
    icon: '☁️',
    color: 'sky',
    classes: TYPE_CLASSES.sky,
    description: 'Katılımcıların yazdığı kelimelerden anlık bulut',
    hasCorrectAnswer: false,
    multipleQuestions: true,
    questionType: 'wordcloud',
  },
};
