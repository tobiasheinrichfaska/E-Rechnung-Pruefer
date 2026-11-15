import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { APP_CONFIG, TEST_AREA } from './config';
import { colorVariables } from './logic/appConfig';
import { App } from './ui/App';
import { TestShell } from './ui/testbereich/TestShell';
import './ui/app.css';

// The Kanzlei colours of this build (config "colors"), set through the CSSOM — allowed by the CSP,
// as in the Fragebogen.
for (const [name, value] of Object.entries(colorVariables(APP_CONFIG.colors))) {
  document.documentElement.style.setProperty(name, value);
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      {/* The test version puts the test page beside the tool; the live build has none */}
      {TEST_AREA ? (
        <TestShell>
          <App />
        </TestShell>
      ) : (
        <App />
      )}
    </StrictMode>,
  );
}
