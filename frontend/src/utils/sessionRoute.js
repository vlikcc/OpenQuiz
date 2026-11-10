export function isVoterSearch(search) {
  const params = new URLSearchParams(search);
  return params.get('mode') === 'voter' && (!!params.get('id') || !!params.get('code'));
}

export function voterIdFromSearch(search) {
  return new URLSearchParams(search).get('id');
}

export function voterCodeFromSearch(search) {
  return (new URLSearchParams(search).get('code') || '').trim();
}

export function isResultsSearch(search) {
  const params = new URLSearchParams(search);
  return params.get('mode') === 'results' && !!params.get('token');
}

export function resultsTokenFromSearch(search) {
  return new URLSearchParams(search).get('token');
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

/** True for an address only the machine itself can open — never a phone in the room. */
export function isLoopbackOrigin(origin) {
  try {
    const host = new URL(origin).hostname;
    return LOOPBACK_HOSTS.has(host) || host.endsWith('.localhost');
  } catch {
    return false;
  }
}

/**
 * Where a join link should point. The address in the presenter's own address
 * bar wins — it is the one that demonstrably works — unless it is loopback,
 * in which case the server's configured public address is the better guess.
 */
export function joinOrigin(currentOrigin, publicUrl) {
  if (!isLoopbackOrigin(currentOrigin) || !publicUrl || isLoopbackOrigin(publicUrl)) {
    return currentOrigin;
  }
  return publicUrl.replace(/\/$/, '');
}

export function voterJoinUrl(origin, { code, pollId }) {
  const base = `${origin.replace(/\/$/, '')}/?mode=voter`;
  if (code) return `${base}&code=${encodeURIComponent(code)}`;
  return `${base}&id=${encodeURIComponent(pollId)}`;
}

export function resultsShareUrl(origin, token) {
  return `${origin.replace(/\/$/, '')}/?mode=results&token=${encodeURIComponent(token)}`;
}
