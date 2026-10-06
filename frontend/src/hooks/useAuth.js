import { useEffect, useState, useCallback } from 'react';
import { tokenStore } from '../services/tokenStore';
import { authService } from '../services/authService';

export function useAuth() {
  const [user, setUser] = useState(() => tokenStore.getUser());
  const [loading, setLoading] = useState(() => !!tokenStore.getAccessToken() && !tokenStore.getUser());

  useEffect(() => {
    const unsub = tokenStore.subscribe(() => setUser(tokenStore.getUser()));
    return unsub;
  }, []);

  // Refresh /me on mount if we have a token but no cached user.
  useEffect(() => {
    let alive = true;
    if (tokenStore.getAccessToken() && !tokenStore.getUser()) {
      authService.me()
        .then((u) => { if (alive) setUser(u); })
        .catch(() => { tokenStore.clear(); if (alive) setUser(null); })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  return { user, loading, logout, isAuthenticated: !!user };
}
