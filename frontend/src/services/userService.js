import { api } from './apiClient';

export const userService = {
  listAuthorized: () => api.get('/api/users/authorized'),
  addAuthorized: (email) => api.post('/api/users/authorized', { email }),
  removeAuthorized: (email) => api.delete(`/api/users/authorized/${encodeURIComponent(email)}`),
  listRegistered: () => api.get('/api/users/registered'),
};
