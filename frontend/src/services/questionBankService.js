import { QUESTION_TYPE_KEY, QUESTION_TYPE_VALUE } from '../config/constants';
import { DEFAULT_MODERATION, parseModeration, toWordCloudConfig } from '../utils/wordCloudSettings';
import { api } from './apiClient';

export function draftToBankRequest(q) {
  return {
    text: q.text,
    imageUrl: q.image || q.imageUrl || '',
    timeLimit: q.timeLimit || 30,
    questionType: QUESTION_TYPE_VALUE[q.questionType] || QUESTION_TYPE_VALUE.multiple,
    allowMultiple: !!q.allowMultiple,
    correctOptionIndex: q.correctIndex ?? q.correctOptionIndex ?? 0,
    correctAnswer: q.correctAnswer || null,
    points: q.points || 10,
    maxWords: q.questionType === 'wordcloud' ? (q.maxWords || 3) : null,
    wordCloudConfig: q.questionType === 'wordcloud' ? toWordCloudConfig(q.moderation) : null,
    options: (q.options || []).map((opt, i) => ({
      orderIndex: i,
      text: typeof opt === 'string' ? opt : opt.text,
    })),
  };
}

export function bankItemToDraft(item) {
  const qt = QUESTION_TYPE_KEY[item.questionType] || 'multiple';
  if (qt === 'open') {
    return {
      text: item.text,
      questionType: 'open',
      correctAnswer: item.correctAnswer || '',
      points: item.points || 10,
      image: item.imageUrl || '',
      timeLimit: item.timeLimit || 30,
    };
  }
  if (qt === 'wordcloud') {
    return {
      text: item.text,
      questionType: 'wordcloud',
      image: item.imageUrl || '',
      timeLimit: item.timeLimit || 60,
      maxWords: item.maxWords || 3,
      moderation: parseModeration(item.wordCloudConfig) || { ...DEFAULT_MODERATION },
    };
  }
  return {
    text: item.text,
    questionType: 'multiple',
    allowMultiple: item.allowMultiple || false,
    options: (item.options || []).map((o) => o.text),
    correctIndex: item.correctOptionIndex ?? 0,
    points: item.points || 10,
    image: item.imageUrl || '',
    timeLimit: item.timeLimit || 30,
  };
}

export const questionBankService = {
  list: () => api.get('/api/question-bank'),
  create: (data) => api.post('/api/question-bank', data),
  update: (id, data) => api.put(`/api/question-bank/${id}`, data),
  remove: (id) => api.delete(`/api/question-bank/${id}`),
};
