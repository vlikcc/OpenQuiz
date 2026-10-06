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

export function voterJoinUrl(origin, { code, pollId }) {
  const base = `${origin.replace(/\/$/, '')}/?mode=voter`;
  if (code) return `${base}&code=${encodeURIComponent(code)}`;
  return `${base}&id=${encodeURIComponent(pollId)}`;
}

export function resultsShareUrl(origin, token) {
  return `${origin.replace(/\/$/, '')}/?mode=results&token=${encodeURIComponent(token)}`;
}
