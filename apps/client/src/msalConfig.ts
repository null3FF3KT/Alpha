import type { Configuration } from '@azure/msal-browser';
/* Security: Do not cache bearer tokens in localStorage. Use MSAL memory/session storage. */


// Do NOT cache tokens in localStorage; MSAL keeps tokens in memory/session by default, reducing theft risk.
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AAD_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AAD_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
};

export const apiScope = import.meta.env.VITE_APIM_SCOPE!; // api://<apim-app-id>/.default or specific scope
export const apiBaseUrl = import.meta.env.VITE_APIM_BASE_URL!; // https://apim.example.com
