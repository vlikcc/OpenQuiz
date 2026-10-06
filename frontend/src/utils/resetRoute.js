/** The e-mail's link is `{PublicUrl}/reset-password?token=…`. */
export function isPasswordResetPath(pathname) {
  return /(?:^|\/)reset-password\/?$/.test(pathname);
}

export function resetTokenFromSearch(search) {
  const query = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(query).get('token') || '';
}
