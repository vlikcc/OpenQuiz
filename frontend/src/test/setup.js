import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';
import i18n from '../i18n';

// Node 25+ exposes a global localStorage getter that is inert unless
// --localstorage-file is set, and that getter wins over jsdom's Storage.
function ensureLocalStorage() {
  try {
    if (typeof globalThis.localStorage?.getItem === 'function') return;
  } catch {
    // The experimental getter can throw; replace it below.
  }

  const store = new Map();
  const localStorage = {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => { store.set(String(key), String(value)); },
    removeItem: (key) => { store.delete(String(key)); },
    clear: () => { store.clear(); },
    key: (index) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: localStorage,
  });
}

ensureLocalStorage();

// The detector would otherwise pick the language up from the environment and
// make the rendered copy differ between machines.
beforeAll(() => i18n.changeLanguage('tr'));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
