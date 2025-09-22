import { getLocalConfig } from './config.local';
import { getQuorumApiConfig } from './config.quorum';

export const getConfig = function () {
  // Use relative URLs for localhost development to enable Vite proxy
  if (typeof window !== 'undefined' &&
      window.location.hostname === 'localhost' &&
      import.meta.hot) {
    return {
      quorumApiUrl: '/api',
      quorumWsUrl: 'ws://localhost:5173/ws', // WebSocket proxy not yet configured
      apiVersion: 'v1',
      langId: 'en-US',
    };
  }

  // Production and staging use direct API URLs
  return getQuorumApiConfig();
};
