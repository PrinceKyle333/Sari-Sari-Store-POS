import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initNativeShell, isNativeApp } from './utils/native';

// The service worker is only for the web/PWA build. Inside the native app the
// bundle is already served locally, so offline support comes for free.
if (!isNativeApp) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

createRoot(document.getElementById('root')!).render(<App />);

void initNativeShell();
