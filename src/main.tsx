import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handlers for debugging mobile initialization
window.onerror = function(msg, url, lineNo, columnNo, error) {
  const errorMsg = `Error: ${msg}\nScript: ${url}\nLine: ${lineNo}\nColumn: ${columnNo}\nStackTrace: ${error?.stack}`;
  console.error(errorMsg);
  // Optional: show a small alert or append to body if we're stuck
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `<div style="padding: 20px; color: white; background: red; font-family: sans-serif;">
      <h1>Startup Error</h1>
      <pre style="white-space: pre-wrap; font-size: 12px;">${errorMsg}</pre>
    </div>`;
  }
  return false;
};

window.onunhandledrejection = function(event) {
  console.error('Unhandled Promise Rejection:', event.reason);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
