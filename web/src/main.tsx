import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../../src/shared/ui.css';
import './web.css';
import { App } from './App';
import { AuthProvider } from './lib/auth';
import { applyTextSize } from './lib/textsize';

applyTextSize();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider><App /></AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
