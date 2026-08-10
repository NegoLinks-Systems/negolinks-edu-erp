import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppProviders } from './providers/app-providers';
import App from './App';
import './index.css';

// Force dark mode for Tailwind
document.documentElement.classList.add('dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
        <Toaster
          theme="dark"
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
