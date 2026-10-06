const KEY = 'oq.theme';

export function getStoredTheme() {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', next === 'dark');
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Private mode can refuse storage; the class still applies for this visit.
  }
}

export function initTheme() {
  applyTheme(getStoredTheme());
}
