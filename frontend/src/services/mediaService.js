import { api } from './apiClient';

export const mediaService = {
  upload(file) {
    const body = new FormData();
    body.append('file', file);
    return api.postForm('/api/media', body);
  },
};
