import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';

const isIOSBrowser = (() => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  const isTouchMac = userAgent.includes('Mac') && (navigator.maxTouchPoints ?? 0) > 1;
  return /iPhone|iPad|iPod/i.test(userAgent) || isTouchMac;
})();

const clearServiceWorkers = () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  void navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined);
};

if (import.meta.env.PROD && !isIOSBrowser) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Falha ao registrar Service Worker:', error);
    },
  });
} else {
  clearServiceWorkers();
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
