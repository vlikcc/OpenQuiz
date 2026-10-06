import { api } from './apiClient';

export const infoService = {
  get: () => api.get('/api/info', { auth: false }),
};
