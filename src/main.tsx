import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './i18n';
import { registerServiceWorker } from './registerServiceWorker';
import './styles.css';

void registerServiceWorker();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Suspense fallback={undefined}>
      <App />
    </Suspense>
  </StrictMode>
);
