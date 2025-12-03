/**
 * Centralized environment detection and domain whitelisting
 * Used by invite links, message links, and future deep link features
 */

export type Environment = 'production' | 'staging' | 'localhost' | 'custom';

export interface EnvironmentInfo {
  environment: Environment;
  domains: string[];        // Valid domains for this environment
  protocol: 'http' | 'https';
  currentDomain: string;    // The detected current domain
}

/**
 * Detect current environment and return valid domains
 * Single source of truth for domain whitelisting
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  if (typeof window === 'undefined') {
    return {
      environment: 'production',
      domains: ['qm.one', 'app.quorummessenger.com'],
      protocol: 'https',
      currentDomain: 'qm.one'
    };
  }

  const { hostname, port } = window.location;

  // STAGING
  if (hostname === 'test.quorummessenger.com') {
    return {
      environment: 'staging',
      domains: ['test.quorummessenger.com'],
      protocol: 'https',
      currentDomain: hostname
    };
  }

  // PRODUCTION
  if (hostname === 'app.quorummessenger.com' || hostname === 'qm.one') {
    return {
      environment: 'production',
      domains: ['qm.one', 'app.quorummessenger.com'],
      protocol: 'https',
      currentDomain: hostname
    };
  }

  // LOCALHOST
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const localDomain = port ? `${hostname}:${port}` : hostname;
    return {
      environment: 'localhost',
      domains: [localDomain],
      protocol: 'http',
      currentDomain: localDomain
    };
  }

  // CUSTOM DEPLOYMENT
  return {
    environment: 'custom',
    domains: [hostname],
    protocol: 'https',
    currentDomain: hostname
  };
}

/**
 * Build URL prefixes for a given path pattern
 * @param pathSuffix - The path to append (e.g., '/spaces/', '/#', '/invite/#')
 * @returns Array of valid URL prefixes including relative paths
 */
export function buildValidPrefixes(pathSuffix: string): string[] {
  const { domains, protocol } = getEnvironmentInfo();
  const prefixes: string[] = [];

  for (const domain of domains) {
    prefixes.push(`${protocol}://${domain}${pathSuffix}`);
    prefixes.push(`${domain}${pathSuffix}`);
  }

  // Always accept relative paths (starts with /)
  if (pathSuffix.startsWith('/')) {
    prefixes.push(pathSuffix);
  }

  return prefixes;
}
