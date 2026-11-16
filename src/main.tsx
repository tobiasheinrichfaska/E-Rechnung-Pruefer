import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { APP_CONFIG } from './config';
import { colorVariables } from './logic/appConfig';
import { startTestArea } from './testArea';
import { App } from './ui/App';
import './ui/app.css';

// The Kanzlei colours of this build (config "colors"), set through the CSSOM — allowed by the CSP,
// as in the Fragebogen.
for (const [name, value] of Object.entries(colorVariables(APP_CONFIG.colors))) {
  document.documentElement.style.setProperty(name, value);
}

// The test version (`npm run build:test`) mounts the tool inside the shared test frame
// (src/testArea.tsx). Every other build resolves that module to a stub whose function only throws
// (vite.config.ts): the build folds the condition on the mode, drops the unused stub, and nothing of
// the frame, its style or the manual tests reaches the live file. A static import, not import() as
// in Testumgebung's docs/testrahmen.md: in the single file, the lazy module of an import() waited
// forever on the tool's modules with top-level await (libxml2-wasm), so the test version never
// started.
if (import.meta.env.MODE === 'testbereich') {
  startTestArea();
} else {
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
}
