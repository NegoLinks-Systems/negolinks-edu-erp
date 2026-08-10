import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppProviders } from './providers/app-providers';
import App from './App';
import './index.css';
import { applyTheme, getSavedTheme } from './lib/use-theme';

// Apply saved theme before first paint — prevents flash of wrong theme
applyTheme(getSavedTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
        <Toaster
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              border: '1px solid var(--accent-border)',
              color: 'var(--text-primary)',
            },
          }}
          richColors
          position="top-right"
        />
      </AppProviders>
    </BrowserRouter>
  </React.StrictMode>,
);
