import 'katex/dist/katex.min.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, watchSystemTheme } from './lib/theme';

applyTheme();
watchSystemTheme();
// iOS Safari only applies :active (the instant press feedback) when a touch listener exists.
document.addEventListener('touchstart', () => {}, { passive: true });

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
