import { Configuration, RedirectRequest } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_APP_CLIENT_ID,
    authority: import.meta.env.VITE_APP_AUTHORITY,
    redirectUri: import.meta.env.VITE_APP_REDIRECT_URI,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest: RedirectRequest = {
  scopes: [`api://${import.meta.env.VITE_APP_CLIENT_ID}/access_as_user`]
}; 