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

// iOS Safari PWA fix: registering a non-passive touchstart listener "claims" the touch
// sequence, which makes all subsequent touchmove events cancelable (e.cancelable = true).
// Without this, iOS marks touchmove as non-cancelable and preventDefault() has no effect.
document.addEventListener('touchstart', (_e) => {
  // intentionally empty — non-passive registration is what matters
}, { passive: false });

// Prevent iOS overscroll/bounce on the game viewport.
// Allows scroll inside panels that have overflow-y-auto / overflow-y-scroll classes.
document.addEventListener('touchmove', (e) => {
  const target = e.target as Element | null;
  if (target?.closest('.overflow-y-auto, .overflow-y-scroll, [data-scrollable]')) return;
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
