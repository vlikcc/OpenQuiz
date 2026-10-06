import { api } from './apiClient';
import { fetchAllPages, pageQuery } from './paging';

export const voteService = {
  submit: (pollId, payload) => api.post(`/api/polls/${pollId}/votes`, payload, { auth: false }),
  submitOpen: (pollId, payload) => api.post(`/api/polls/${pollId}/open-answers`, payload, { auth: false }),
  list: (pollId, paging) => api.get(`/api/polls/${pollId}/votes?${pageQuery(paging)}`),
  listOpen: (pollId, paging) => api.get(`/api/polls/${pollId}/open-answers?${pageQuery(paging)}`),
  aggregates: (pollId) => api.get(`/api/polls/${pollId}/aggregates`, { auth: false }),

  /** Grades one written answer. Pass null to take a grade back. */
  scoreOpen: (pollId, answerId, score) =>
    api.put(`/api/polls/${pollId}/open-answers/${answerId}/score`, { score }),

  /** Every vote, for the exports. */
  allVotes: (pollId) => fetchAllPages((paging) => voteService.list(pollId, paging)),

  /** Every open answer, for the presenter and the exports. */
  allOpen: (pollId) => fetchAllPages((paging) => voteService.listOpen(pollId, paging)),
};
