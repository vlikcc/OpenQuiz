import { api } from './apiClient';
import { pageQuery } from './paging';

export const pollService = {
  /** Paged summaries: `{ items, page, pageSize, totalCount, hasMore }`. */
  list: (paging) => api.get(`/api/polls?${pageQuery(paging)}`),
  get: (id) => api.get(`/api/polls/${id}`, { auth: false }),
  getByCode: (code) => api.get(`/api/polls/code/${encodeURIComponent(code)}`, { auth: false }),
  getShared: (token) => api.get(`/api/polls/shared/${encodeURIComponent(token)}`, { auth: false }),
  create: (data) => api.post('/api/polls', data),
  update: (id, data) => api.put(`/api/polls/${id}`, data),

  /** A fresh, unplayed copy of a poll, for running it with another group. */
  duplicate: (id, title) => api.post(`/api/polls/${id}/duplicate`, { title }),
  /** Owner-only: drop every answer and score so the same poll can run again. */
  resetResults: (id) => api.post(`/api/polls/${id}/reset-results`),
  remove: (id) => api.delete(`/api/polls/${id}`),
  activate: (id) => api.post(`/api/polls/${id}/activate`),
  nextQuestion: (id) => api.post(`/api/polls/${id}/next-question`),
  prevQuestion: (id) => api.post(`/api/polls/${id}/prev-question`),
  end: (id) => api.post(`/api/polls/${id}/end`),
  join: (id, userName) => api.post(`/api/polls/${id}/join`, { userName }, { auth: false }),

  listCollaborators: (id) => api.get(`/api/polls/${id}/collaborators`),
  addCollaborator: (id, email) => api.post(`/api/polls/${id}/collaborators`, { email }),
  removeCollaborator: (id, userId) => api.delete(`/api/polls/${id}/collaborators/${userId}`),

  enableResultsShare: (id) => api.post(`/api/polls/${id}/results-share`),
  disableResultsShare: (id) => api.delete(`/api/polls/${id}/results-share`),

  /** Owner-only dump for CSV/Excel/PDF. Gated on reports.export (402). */
  report: (id) => api.get(`/api/polls/${id}/report`),
};
