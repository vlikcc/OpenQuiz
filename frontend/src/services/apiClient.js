import { API_BASE_URL } from '../config/constants';
import { tokenStore } from './tokenStore';

const NO_BODY = Symbol('no-body');
let refreshPromise = null;

// Module-level, not React state, so this fetch wrapper stays framework-free —
// the same trick tokenStore.js uses for its pub/sub. App.jsx wires this to
// raise the upgrade modal from wherever a 402 happens to originate.
let planLimitHandler = null;
export function setPlanLimitHandler(fn) {
  planLimitHandler = fn;
}

async function attemptRefresh() {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        tokenStore.clear();
        return null;
      }
      const data = await res.json();
      tokenStore.set(data);
      return data.accessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request(method, path, body = NO_BODY, { auth = true, form = false } = {}) {
  const headers = { Accept: 'application/json' };
  let payload;
  if (body !== NO_BODY) {
    if (form) {
      payload = body;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  let token = auth ? tokenStore.getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: payload });

  if (res.status === 401 && auth) {
    const newToken = await attemptRefresh();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: payload });
    }
  }

  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch { err = { title: res.statusText }; }
    const message = err?.detail || err?.title || `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.problem = err;

    // 402 carries a machine-readable discriminator in the ProblemDetails body
    // (plan_limit_exceeded / plan_feature_required — see Errors.cs on the
    // backend) so the frontend can raise an upgrade prompt instead of a bare
    // error toast, without parsing the human-readable message.
    if (res.status === 402) {
      error.planLimit = {
        code: err?.title,
        limitKey: err?.limitKey,
        featureKey: err?.featureKey,
        limit: err?.limit,
        attempted: err?.attempted,
        requiredPlan: err?.requiredPlan,
      };
      planLimitHandler?.(error.planLimit);
    }

    throw error;
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path, opts) => request('GET', path, NO_BODY, opts),
  post: (path, body, opts) => request('POST', path, body ?? {}, opts),
  put: (path, body, opts) => request('PUT', path, body ?? {}, opts),
  delete: (path, opts) => request('DELETE', path, NO_BODY, opts),
  // Browser sets the multipart boundary; do not assign Content-Type here.
  postForm: (path, formData, opts) => request('POST', path, formData, { ...opts, form: true }),
};
