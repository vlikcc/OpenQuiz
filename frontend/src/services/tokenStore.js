const ACCESS_KEY = 'oq.accessToken';
const REFRESH_KEY = 'oq.refreshToken';
const ACCESS_EXP_KEY = 'oq.accessExp';
const USER_KEY = 'oq.user';

const listeners = new Set();

function emit() {
  listeners.forEach((cb) => {
    try { cb(); } catch { /* noop */ }
  });
}

export const tokenStore = {
  getAccessToken: () => localStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  getAccessExp: () => {
    const v = localStorage.getItem(ACCESS_EXP_KEY);
    return v ? new Date(v) : null;
  },
  getUser: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  },
  set(authResponse) {
    if (!authResponse) return;
    localStorage.setItem(ACCESS_KEY, authResponse.accessToken);
    localStorage.setItem(REFRESH_KEY, authResponse.refreshToken);
    if (authResponse.accessTokenExpiresAt) {
      localStorage.setItem(ACCESS_EXP_KEY, authResponse.accessTokenExpiresAt);
    }
    if (authResponse.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
    }
    emit();
  },
  setUser(user) {
    if (!user) return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    emit();
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ACCESS_EXP_KEY);
    localStorage.removeItem(USER_KEY);
    emit();
  },
  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};
