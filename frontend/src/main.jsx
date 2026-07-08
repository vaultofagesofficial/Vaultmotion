import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App.jsx';
import './index.css';

// API-key meesturen wanneer de backend beveiligd is (VAULTMOTION_API_KEY).
// De key wordt ingesteld via Instellingen en bewaard in localStorage.
axios.interceptors.request.use(config => {
  try {
    const key = localStorage.getItem('vm_api_key');
    if (key && (config.url || '').startsWith('/api')) config.headers['x-api-key'] = key;
  } catch {}
  return config;
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
