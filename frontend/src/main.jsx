import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from './config/constants';
import App from './App.jsx';
import './index.css';
import './i18n';
import { initTheme } from './utils/theme';

initTheme();

const root = createRoot(document.getElementById('root'));

const tree = (
  <StrictMode>
    <App />
  </StrictMode>
);

root.render(
  GOOGLE_CLIENT_ID
    ? <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{tree}</GoogleOAuthProvider>
    : tree,
);

// The splash in index.html covers the gap before the bundle runs. Fading it out
// from here rather than an inline script keeps the page free of inline
// JavaScript, which is what lets the CSP forbid it outright. The second frame
// is the first one React has painted into, so the splash never uncovers a blank
// page.
requestAnimationFrame(() => requestAnimationFrame(() => {
  const loader = document.getElementById('initial-loader');
  if (!loader) return;

  loader.classList.add('hidden');
  setTimeout(() => loader.remove(), 300);
}));
