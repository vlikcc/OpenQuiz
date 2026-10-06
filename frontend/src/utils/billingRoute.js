/** Manual checkout lands on `{PublicUrl}/?billing=contact&plan=pro`. */

function paramsFromSearch(search) {
  const query = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(query);
}

export function isBillingContactSearch(search) {
  return paramsFromSearch(search).get('billing') === 'contact';
}

export function planFromSearch(search) {
  return paramsFromSearch(search).get('plan') || '';
}
