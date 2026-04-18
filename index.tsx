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

// Prevent iOS Safari from scrolling/bouncing the page when touching the 3D canvas.
// Must be non-passive to call preventDefault().
document.addEventListener('touchmove', (e) => {
  if (e.cancelable) e.preventDefault();
}, { passive: false });

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
