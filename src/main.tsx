'use client';

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import './index.css';

// Graceful handler for harmless sandbox WebSocket / HMR disconnect logs
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('[vite] failed to connect to websocket') || msg.includes('WebSocket connection to')) {
      // Benign dev sandbox notice - suppressed to maintain clean client telemetry
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('[vite] failed to connect to websocket') || msg.includes('WebSocket connection to')) {
      return;
    }
    originalError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


