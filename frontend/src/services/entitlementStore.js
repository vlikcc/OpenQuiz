// Mirrors tokenStore.js: a module-level localStorage-backed store with a tiny
// pub/sub, so useEntitlements can subscribe the same way useAuth subscribes
// to tokenStore, with no state library involved.
const ENTITLEMENTS_KEY = 'oq.entitlements';
const FETCHED_AT_KEY = 'oq.entitlements.fetchedAt';

const listeners = new Set();

function emit() {
  listeners.forEach((cb) => {
    try { cb(); } catch { /* noop */ }
  });
}

export const entitlementStore = {
  get: () => {
    try { return JSON.parse(localStorage.getItem(ENTITLEMENTS_KEY) || 'null'); } catch { return null; }
  },
  /** Milliseconds since epoch of the last successful fetch, or null if never fetched. */
  getFetchedAt: () => {
    const v = localStorage.getItem(FETCHED_AT_KEY);
    return v ? Number(v) : null;
  },
  set(entitlements) {
    if (!entitlements) return;
    localStorage.setItem(ENTITLEMENTS_KEY, JSON.stringify(entitlements));
    localStorage.setItem(FETCHED_AT_KEY, String(Date.now()));
    emit();
  },
  clear() {
    localStorage.removeItem(ENTITLEMENTS_KEY);
    localStorage.removeItem(FETCHED_AT_KEY);
    emit();
  },
  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};
