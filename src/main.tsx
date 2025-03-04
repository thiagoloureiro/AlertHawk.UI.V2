import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from './auth/msalConfig';
import App from './App';
import './index.css';
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_APP_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});


const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL before rendering
const initializeMsal = async () => {
  try {
    await msalInstance.initialize();
    
    // Only render after initialization
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </StrictMode>
    );
  } catch (error) {
    console.error('Failed to initialize MSAL:', error);
  }
};

initializeMsal();
