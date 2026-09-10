import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Application Error" fallbackMessage="An unhandled application error occurred. Click Try Again to restart the application.">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
