import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StudioApp } from './StudioApp';

const root = document.getElementById('studio-root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <StudioApp />
    </StrictMode>,
  );
}
