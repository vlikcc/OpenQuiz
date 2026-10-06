import { useEffect, useState, useCallback, useMemo } from 'react';
import { tokenStore } from '../services/tokenStore';
import { entitlementStore } from '../services/entitlementStore';
import { entitlementService } from '../services/entitlementService';

// Entitlements change rarely (an upgrade, at most a few times a year); this
// just keeps a long-lived tab from going a whole session without a refresh.
const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Mirrors useAuth.js: reads from a module-level store so components stay in
 * sync without a context provider, and refetches on the moments an upgrade
 * could have happened elsewhere — sign-in, another tab, the window regaining
 * focus, or an explicit refresh() after a 402 (wired in App.jsx).
 *
 * refresh() never sets state synchronously before its first await, the same
 * discipline useAuth.js's own mount effect follows — only .then/.finally
 * callbacks touch state, so calling it directly from an effect body is safe.
 */
export function useEntitlements() {
  const [entitlements, setEntitlements] = useState(() => entitlementStore.get());
  const [loading, setLoading] = useState(() => !!tokenStore.getAccessToken() && !entitlementStore.get());

  const refresh = useCallback(() => {
    if (!tokenStore.getAccessToken()) return Promise.resolve();
    return entitlementService.me()
      .then((fresh) => setEntitlements(fresh))
      .catch(() => {
        // Not fatal: can()/limit() below simply report nothing unlocked
        // until the next successful fetch.
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsub = entitlementStore.subscribe(() => setEntitlements(entitlementStore.get()));
    return unsub;
  }, []);

  // Sign-in swaps which account's entitlements apply; sign-out drops them.
  useEffect(() => {
    const unsub = tokenStore.subscribe(() => {
      if (tokenStore.getAccessToken()) refresh();
      else { entitlementStore.clear(); setEntitlements(null); }
    });
    return unsub;
  }, [refresh]);

  useEffect(() => {
    if (!tokenStore.getAccessToken()) return;
    const fetchedAt = entitlementStore.getFetchedAt();
    if (!fetchedAt || Date.now() - fetchedAt > STALE_AFTER_MS) refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && tokenStore.getAccessToken()) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const values = useMemo(() => entitlements?.values ?? {}, [entitlements]);
  const usage = entitlements?.usage ?? {};

  const can = useCallback((key) => !!values[key], [values]);
  const limit = useCallback((key) => (key in values ? values[key] : 0), [values]);

  return {
    entitlements,
    plan: entitlements?.planCode ?? null,
    usage,
    loading,
    can,
    limit,
    refresh,
  };
}
