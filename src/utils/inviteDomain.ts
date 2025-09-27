/**
 * Utility functions for managing invite link domains across different environments
 * Automatically detects staging vs production and uses the appropriate domain
 */

/**
 * Get the base domain for invite links based on the current environment
 * @returns The appropriate domain for invite links
 */
export function getInviteBaseDomain(): string {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const port = window.location.port;

    // Check for staging/test environment
    if (hostname === 'test.quorummessenger.com') {
      // On staging, use the full staging URL for invite links
      return 'test.quorummessenger.com';
    }

    // Check for production environment
    if (hostname === 'app.quorummessenger.com') {
      // On production, use the short domain for invite links
      return 'qm.one';
    }

    // Check for localhost/development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // In development, use localhost with port for invite links
      // This allows testing invite links locally
      return port ? `${hostname}:${port}` : hostname;
    }

    // For any other domain (e.g., custom deployments)
    // Use the current domain as the invite domain
    return hostname;
  }

  // Default to production short domain
  return 'qm.one';
}

/**
 * Get the full URL base for invite links
 * @param isPublicInvite - Whether this is a public invite (uses /invite/ path)
 * @returns The full URL base for invite links
 */
export function getInviteUrlBase(isPublicInvite: boolean = false): string {
  const domain = getInviteBaseDomain();
  const path = isPublicInvite ? '/invite/' : '/';

  // Use http for localhost, https for everything else
  const protocol = domain.startsWith('localhost') || domain.startsWith('127.0.0.1')
    ? 'http'
    : 'https';

  return `${protocol}://${domain}${path}`;
}

/**
 * Get valid invite URL prefixes for validation
 * @returns Array of valid URL prefixes that invite links can start with
 */
export function getValidInvitePrefixes(): string[] {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;

    // STAGING: Only accept staging URLs
    if (hostname === 'test.quorummessenger.com') {
      return [
        'https://test.quorummessenger.com/#',
        'https://test.quorummessenger.com/invite/#',
        'test.quorummessenger.com/#',
        'test.quorummessenger.com/invite/#'
      ];
    }

    // PRODUCTION: Accept both app domain and short domain
    if (hostname === 'app.quorummessenger.com') {
      return [
        // Production app domain
        'https://app.quorummessenger.com/invite/#',
        'https://app.quorummessenger.com/#',
        'app.quorummessenger.com/invite/#',
        'app.quorummessenger.com/#',
        // Production short domain
        'https://qm.one/#',
        'https://qm.one/invite/#',
        'qm.one/#',
        'qm.one/invite/#',
      ];
    }

    // CUSTOM DEPLOYMENT: Only accept current domain
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return [
        `https://${hostname}/#`,
        `https://${hostname}/invite/#`,
        `${hostname}/#`,
        `${hostname}/invite/#`
      ];
    }
  }

  // LOCAL DEVELOPMENT: Accept localhost and all common domains for testing
  const localhostPrefixes = [];

  // Check if we're in localhost to add the current localhost:port
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const port = window.location.port;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const localHost = port ? `${hostname}:${port}` : hostname;
      localhostPrefixes.push(
        `http://${localHost}/#`,
        `http://${localHost}/invite/#`,
        `${localHost}/#`,
        `${localHost}/invite/#`
      );
    }
  }

  return [
    ...localhostPrefixes,
    // Common localhost ports for development
    'http://localhost:5173/#',
    'http://localhost:5173/invite/#',
    'localhost:5173/#',
    'localhost:5173/invite/#',
    'http://localhost:3000/#',
    'http://localhost:3000/invite/#',
    'localhost:3000/#',
    'localhost:3000/invite/#',
    'http://127.0.0.1:5173/#',
    'http://127.0.0.1:5173/invite/#',
    '127.0.0.1:5173/#',
    '127.0.0.1:5173/invite/#',
    // Production domains
    'https://app.quorummessenger.com/invite/#',
    'https://app.quorummessenger.com/#',
    'app.quorummessenger.com/invite/#',
    'app.quorummessenger.com/#',
    'https://qm.one/#',
    'https://qm.one/invite/#',
    'qm.one/#',
    'qm.one/invite/#',
    // Staging domains
    'https://test.quorummessenger.com/#',
    'https://test.quorummessenger.com/invite/#',
    'test.quorummessenger.com/#',
    'test.quorummessenger.com/invite/#'
  ];
}

/**
 * Format the display domain for UI (without protocol)
 * @returns The domain for display in UI elements
 */
export function getInviteDisplayDomain(): string {
  const domain = getInviteBaseDomain();
  return domain;
}

/**
 * Parse invite URL parameters from a link's hash portion into a simple map.
 * Accepts both public and private invite variants.
 */
export function parseInviteParams(inviteLink: string):
  | {
      spaceId?: string;
      configKey?: string;
      template?: string;
      secret?: string;
      hubKey?: string;
    }
  | null {
  if (!inviteLink || typeof inviteLink !== 'string') return null;
  const idx = inviteLink.indexOf('#');
  if (idx < 0 || idx === inviteLink.length - 1) return null;
  const hashContent = inviteLink.slice(idx + 1);
  const params = Object.create(null) as Record<string, string>;
  for (const pair of hashContent.split('&')) {
    const [k, v] = pair.split('=');
    if (!k || !v) continue;
    if (
      k === 'spaceId' ||
      k === 'configKey' ||
      k === 'template' ||
      k === 'secret' ||
      k === 'hubKey'
    ) {
      params[k] = v;
    }
  }
  return Object.keys(params).length ? (params as any) : null;
}