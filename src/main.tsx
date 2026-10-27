import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { VendasProvider } from './state/VendasContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VendasProvider>
      <App />
    </VendasProvider>
  </React.StrictMode>,
);
