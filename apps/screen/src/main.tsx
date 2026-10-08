import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { applyFontScale, readFontScale } from './fontScale.ts';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/onest';
import './styles.css';

// Applied before the first render, even when the host bar is hidden.
applyFontScale(readFontScale());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
