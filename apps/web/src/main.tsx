import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppProviders } from './providers/app-providers';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
        <Toaster richColors position="top-right" />
      </AppProviders>
    </BrowserRouter>
  </React.StrictMode>,
);
