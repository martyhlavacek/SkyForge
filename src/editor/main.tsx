import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorApp } from './EditorApp';

const root = document.getElementById('editor-root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <EditorApp />
    </StrictMode>,
  );
}
