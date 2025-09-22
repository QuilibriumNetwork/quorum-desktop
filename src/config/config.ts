import { getLocalConfig } from './config.local';
import { getQuorumApiConfig } from './config.quorum';
import { getDevConfig } from './config.dev';

export const getConfig = function () {
  // Environment detection for development proxy
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
    const isStaging = hostname === 'test.quorummessenger.com';

    // Use proxy configuration for development and staging
    if (isDev || isStaging) {
      return getDevConfig(); // Uses relative URLs that get proxied
    }
  }

  // Production uses direct API URLs
  return getQuorumApiConfig();
};
