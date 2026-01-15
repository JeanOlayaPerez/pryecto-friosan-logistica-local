import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppRouter } from './app/router';
import './index.css';

const setupCompatMode = () => {
  const params = new URLSearchParams(window.location.search);
  const compatParam = params.get('compat');
  if (compatParam === '0' || compatParam === 'false') {
    return;
  }
  const force = compatParam === '1' || compatParam === 'true' || params.get('tv') === '1';
  const ua = navigator.userAgent || '';
  const isTizen = /Tizen|SMART-TV|SmartTV|Smart-TV/i.test(ua);
  if (force || isTizen) {
    document.documentElement.classList.add('compat-tv');
  }
};

setupCompatMode();

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App>
        <AppRouter />
      </App>
    </BrowserRouter>
  </React.StrictMode>,
);
