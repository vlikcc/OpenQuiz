import { api } from './apiClient';

export const scoreService = {
  /** Anonymous callers get the top 20 at most; the poll's owner can sign the request for the full table. */
  leaderboard: (pollId, top = 100, { auth = false } = {}) => {
    const qs = new URLSearchParams();
    if (pollId) qs.set('pollId', pollId);
    qs.set('top', top);
    return api.get(`/api/scores?${qs.toString()}`, { auth });
  },
  /** Self-paced contests: `{ participants, finished }`. */
  progress: (pollId) => api.get(`/api/scores/progress?pollId=${pollId}`, { auth: false }),
};
