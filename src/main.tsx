import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppRouter } from './app/router';
import './index.css';

const setupCompatMode = () => {
  const getParam = (key: string) => {
    if (typeof URLSearchParams !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get(key);
    }
    const search = window.location.search.replace(/^\?/, '');
    if (!search) return null;
    const parts = search.split('&');
    for (const part of parts) {
      if (!part) continue;
      const [rawKey, rawValue] = part.split('=');
      if (!rawKey) continue;
      const k = decodeURIComponent(rawKey);
      if (k === key) {
        return decodeURIComponent(rawValue ?? '');
      }
    }
    return null;
  };

  const compatParam = getParam('compat');
  const tvParam = getParam('tv');
  const disableCompat = compatParam === '0' || compatParam === 'false' || tvParam === '0';
  if (disableCompat) return;

  const force = compatParam === '1' || compatParam === 'true' || tvParam === '1';
  const ua = navigator.userAgent || '';
  const isTvUa = /Tizen|SMART-TV|SmartTV|Smart-TV|Samsung|Maple/i.test(ua);
  const w = window as Window & { tizen?: unknown; webapis?: unknown };
  const isTvRuntime = Boolean(w.tizen) || Boolean(w.webapis);
  const hasGridSupport = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? CSS.supports('display', 'grid')
    : false;
  const needsCompat = !hasGridSupport || isTvUa || isTvRuntime;

  if (force || needsCompat) {
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
