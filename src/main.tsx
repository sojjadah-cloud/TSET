import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useGame } from './store/gameStore';
import './index.css';

// Dev-only QA hook: lets automated tests drive the real store.
if (import.meta.env.DEV) (window as unknown as { __lunar: typeof useGame }).__lunar = useGame;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
