// Production targets. The browser blocks direct cross-origin calls from the Vite
// dev server (localhost) to these, since the API doesn't send CORS headers for
// localhost. To avoid that during `yarn dev`, we route through Vite's dev proxy
// (see web/vite.config.ts → server.proxy), which forwards server-side so the
// browser only ever talks same-origin (localhost → localhost). No CORS involved.
const PROD_API_URL = 'https://api.quorummessenger.com';
const PROD_WS_URL = 'wss://api.quorummessenger.com/ws';

// Same-origin paths handled by the Vite dev proxy. Empty baseUrl means request
// URLs become same-origin (e.g. `/quorum-api/inbox`), which the proxy intercepts.
const DEV_PROXY_API_URL = '/quorum-api';
const DEV_PROXY_WS_URL = '/quorum-ws';

// True only when running the app in a browser via `yarn dev`. import.meta.env.DEV
// is false in production builds; the `window` check excludes Electron's main
// process (Node), which has no CORS restriction and must use the direct URLs.
const isDevBrowser =
  import.meta.env.DEV && typeof window !== 'undefined';

export const getQuorumApiConfig = function () {
  return {
    quorumApiUrl: isDevBrowser ? DEV_PROXY_API_URL : PROD_API_URL,
    quorumWsUrl: isDevBrowser
      ? `${window.location.origin.replace(/^http/, 'ws')}${DEV_PROXY_WS_URL}`
      : PROD_WS_URL,
    apiVersion: 'v1',
    langId: 'en-US',
  };
};
