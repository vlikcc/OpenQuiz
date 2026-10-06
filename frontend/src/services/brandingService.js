import { api } from './apiClient';

export const brandingService = {
  getMine: () => api.get('/api/branding'),
  update: (payload) => api.put('/api/branding', payload),
  getForPoll: (pollId) => api.get(`/api/polls/${pollId}/branding`, { auth: false }),
};
