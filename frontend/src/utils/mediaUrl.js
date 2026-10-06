import { API_BASE_URL } from '../config/constants';

/** Relative `/api/media/...` URLs need the API origin in Vite dev. */
export function mediaUrl(url) {
  if (!url) return url;
  if (API_BASE_URL && url.startsWith('/api/')) return `${API_BASE_URL}${url}`;
  return url;
}
