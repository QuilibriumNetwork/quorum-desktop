/**
 * Utility functions for managing invite link domains across different environments
 * Automatically detects staging vs production and uses the appropriate domain
 */

import { logger } from '@quilibrium/quorum-shared';
import { buildValidPrefixes, getEnvironmentInfo } from './environmentDomains';

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
 * Uses centralized domain detection from environmentDomains.ts
 * @returns Array of valid URL prefixes that invite links can start with
 */
export function getValidInvitePrefixes(): string[] {
  const { environment } = getEnvironmentInfo();

  // Build prefixes for both invite path variants
  const hashPrefixes = buildValidPrefixes('/#');
  const invitePrefixes = buildValidPrefixes('/invite/#');

  // Production domains should ALWAYS be accepted regardless of current environment
  // This allows mobile-generated links (using qm.one) to work on desktop localhost
  const productionPrefixes = [
    'https://qm.one/#',
    'https://qm.one/invite/#',
    'qm.one/#',
    'qm.one/invite/#',
    'https://app.quorummessenger.com/#',
    'https://app.quorummessenger.com/invite/#',
    'app.quorummessenger.com/#',
    'app.quorummessenger.com/invite/#',
  ];

  // Localhost development: also accept common test ports
  if (environment === 'localhost') {
    return [
      ...hashPrefixes,
      ...invitePrefixes,
      ...productionPrefixes,
      // Keep legacy localhost ports for development
      'http://localhost:5173/#',
      'http://localhost:5173/invite/#',
      'http://localhost:3000/#',
      'http://localhost:3000/invite/#',
    ];
  }

  return [...hashPrefixes, ...invitePrefixes, ...productionPrefixes];
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
  logger.log('[parseInviteParams] Input link:', inviteLink?.substring(0, 150) + (inviteLink?.length > 150 ? '...' : ''));
  logger.log('[parseInviteParams] Link length:', inviteLink?.length);
  if (!inviteLink || typeof inviteLink !== 'string') {
    logger.log('[parseInviteParams] FAIL: inviteLink is falsy or not a string');
    return null;
  }
  const idx = inviteLink.indexOf('#');
  logger.log('[parseInviteParams] Hash index:', idx);
  if (idx < 0 || idx === inviteLink.length - 1) {
    logger.log('[parseInviteParams] FAIL: no hash found or hash is at end of string');
    return null;
  }
  const hashContent = inviteLink.slice(idx + 1);
  logger.log('[parseInviteParams] Hash content length:', hashContent.length);
  logger.log('[parseInviteParams] Hash content preview:', hashContent.substring(0, 200));
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
      logger.log(`[parseInviteParams] Found param: ${k} = ${v?.substring(0, 30)}...`);
    }
  }
  logger.log('[parseInviteParams] Parsed params keys:', Object.keys(params));
  return Object.keys(params).length ? (params as any) : null;
}