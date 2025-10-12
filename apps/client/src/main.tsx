import React from 'react';
/* Telemetry: log page load, sign-in, uploads; MSAL keeps tokens in memory to reduce theft risk. */

import ReactDOM from 'react-dom/client';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { MsalProvider } from 'msal-react';
import { msalConfig } from './msalConfig';
import UploadForm from './components/UploadForm';
import { appInsights } from './telemetry/appInsights';

appInsights.trackPageView({ name: 'Home' });

const pca = new PublicClientApplication(msalConfig);
pca.addEventCallback((e) => {
  if (e.eventType === EventType.LOGIN_SUCCESS) {
    appInsights.trackEvent({ name: 'signin_success' });
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MsalProvider instance={pca}>
      <UploadForm />
    </MsalProvider>
  </React.StrictMode>
);
