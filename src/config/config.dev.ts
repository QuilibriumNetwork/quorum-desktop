export const getDevConfig = function () {
  return {
    quorumApiUrl: '/api', // Proxied through Vite dev server
    quorumWsUrl: '/ws',   // Proxied through Vite dev server
    apiVersion: 'v1',
    langId: 'en-US',
  };
};