
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register the service worker for PWA offline support.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL;
    const normalizedBaseUrl = baseUrl.endsWith('/')
      ? baseUrl
      : `${baseUrl}/`;

    const serviceWorkerUrl = `${normalizedBaseUrl}sw.js`;

    navigator.serviceWorker
      .register(serviceWorkerUrl, {
        scope: normalizedBaseUrl,
        updateViaCache: 'none',
      })
      .then((registration) => {
        console.info('[D-Cam] Service worker registered:', registration.scope);

        // Check whether a newer service worker is available.
        void registration.update().catch((error) => {
          console.warn('[D-Cam] Service worker update check failed:', error);
        });
      })
      .catch((error) => {
        console.error('[D-Cam] Service worker registration failed:', error);
      });
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('D-Cam could not start: root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
