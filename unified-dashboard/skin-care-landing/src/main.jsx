import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/landing.css';
import './styles/funnel.css';

// #region agent log
if (typeof window !== 'undefined') {
  window.__scPerf0 = performance.now();
  fetch('http://127.0.0.1:7305/ingest/f9cb3960-7315-4ebc-b907-ebcee7ad8a07', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f7004c' },
    body: JSON.stringify({
      sessionId: 'f7004c',
      hypothesisId: 'H3',
      location: 'main.jsx:boot',
      message: 'app_boot',
      data: { perfMs: window.__scPerf0, path: window.location.pathname },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
