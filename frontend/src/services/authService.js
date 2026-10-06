import { api } from './apiClient';
import { tokenStore } from './tokenStore';

async function applyAuth(res) {
  tokenStore.set(res);
  return res.user;
}

export const authService = {
  async googleLogin(idToken) {
    return applyAuth(await api.post('/api/auth/google', { idToken }, { auth: false }));
  },
  async register(email, password, displayName) {
    return applyAuth(await api.post('/api/auth/register', { email, password, displayName }, { auth: false }));
  },
  async login(email, password) {
    return applyAuth(await api.post('/api/auth/login', { email, password }, { auth: false }));
  },
  async logout() {
    const refreshToken = tokenStore.getRefreshToken();
    try { if (refreshToken) await api.post('/api/auth/logout', { refreshToken }, { auth: false }); }
    finally { tokenStore.clear(); }
  },
  async me() {
    const user = await api.get('/api/auth/me');
    tokenStore.setUser(user);
    return user;
  },
  passwordResetRequest: (email) =>
    api.post('/api/auth/password-reset/request', { email }, { auth: false }),
  passwordResetConfirm: (token, newPassword) =>
    api.post('/api/auth/password-reset/confirm', { token, newPassword }, { auth: false }),
};
