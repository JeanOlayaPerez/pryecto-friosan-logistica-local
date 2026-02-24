import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getFirestore as getFirestoreLite } from 'firebase/firestore/lite';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

const shouldUseLongPolling = () => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTv = /Tizen|SMART-TV|SmartTV|Smart-TV|Samsung|Maple/i.test(ua);
  const lacksFetch = typeof window.fetch !== 'function';
  const lacksTextEncoder = typeof (window as Window & { TextEncoder?: unknown }).TextEncoder === 'undefined';
  const lacksCrypto =
    !('crypto' in window) ||
    typeof window.crypto?.getRandomValues !== 'function';
  return isTv || lacksFetch || lacksTextEncoder || lacksCrypto;
};

const useLongPolling = shouldUseLongPolling();

export const db = useLongPolling
  ? initializeFirestore(app, {
      experimentalForceLongPolling: true,
    })
  : getFirestore(app);

export const dbLite = getFirestoreLite(app);
export const storage = getStorage(app);
