import { api } from './apiClient';

export const wordcloudService = {
  submit: (pollId, payload) => api.post(`/api/polls/${pollId}/wordcloud/submit`, payload, { auth: false }),
  get: (pollId, questionIndex, topN = 50) =>
    api.get(`/api/polls/${pollId}/wordcloud/${questionIndex}?topN=${topN}`, { auth: false }),
};
