import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Router } from 'wouter';
import { App } from './App';
import './i18n';
import { appRouterBase } from './routing';
import { registerServiceWorker } from './workers/registerServiceWorker';
import './styles.css';

void registerServiceWorker();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Suspense fallback={undefined}>
      <Router base={appRouterBase}>
        <App />
      </Router>
    </Suspense>
  </StrictMode>
);
