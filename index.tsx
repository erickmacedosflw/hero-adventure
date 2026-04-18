import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';

const clearServiceWorkers = () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  void navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined);
};

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Falha ao registrar Service Worker:', error);
    },
  });
} else {
  clearServiceWorkers();
}

// iOS PWA (WKWebView) fix: use window — fires before document, before browser
// decides to handle the gesture natively. Non-passive touchstart "claims" the
// touch sequence so subsequent touchmove events are cancelable.
window.addEventListener('touchstart', () => {
  // intentionally empty — non-passive claim is what matters
}, { passive: false });

// Block viewport scroll/bounce on any element that is NOT a scrollable panel.
window.addEventListener('touchmove', (e: TouchEvent) => {
  const target = e.target as Element | null;
  if (target?.closest('.overflow-y-auto, .overflow-y-scroll, .overflow-x-auto, .overflow-x-scroll, [data-scrollable]')) return;
  e.preventDefault();
}, { passive: false });

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
