import { api } from './apiClient';

export const scoreService = {
  leaderboard: (pollId, top = 100) => {
    const qs = new URLSearchParams();
    if (pollId) qs.set('pollId', pollId);
    qs.set('top', top);
    return api.get(`/api/scores?${qs.toString()}`, { auth: false });
  },
};
