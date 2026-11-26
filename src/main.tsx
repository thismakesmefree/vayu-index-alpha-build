import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import 'leaflet/dist/leaflet.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Vayu Index service worker registration failed:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
