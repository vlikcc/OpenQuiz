import { api } from './apiClient';

export const reactionService = {
  send: (pollId, emoji, sender) =>
    api.post(`/api/polls/${pollId}/reactions`, { emoji, sender }, { auth: false }),

  /** How often each reaction was sent over the whole session. */
  tally: (pollId) => api.get(`/api/polls/${pollId}/reactions`, { auth: false }),
};
