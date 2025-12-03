import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { SearchContext } from '../db/messages';

interface RouteParams {
  spaceId?: string;
  channelId?: string;
  conversationId?: string;
  address?: string; // For DM routes
}

// Mobile-specific implementation without react-router-dom dependency
// TODO: This will need to be updated when React Navigation is implemented
// For now, it maintains the same logic structure as web but with placeholder navigation
export const useSearchContext = (): SearchContext => {
  // MOBILE TODO: Replace with React Navigation hooks when implemented
  // const route = useRoute();
  // const navigation = useNavigation();

  // For now, we'll simulate the web logic structure but with mobile defaults
  const location = { pathname: '/default' }; // Placeholder - replace with React Navigation
  const params: RouteParams = {}; // Placeholder - replace with React Navigation params

  return useMemo((): SearchContext => {
    const pathname = location.pathname;

    // Direct message routes - same logic as web
    if (pathname.includes('/messages/')) {
      // For /messages/:address routes, get address from params
      if (params.address) {
        const conversationId = `${params.address}/${params.address}`;
        const context = { type: 'dm' as const, conversationId };
        return context;
      }

      // Legacy: try to get from conversationId param
      if (params.conversationId) {
        const context = {
          type: 'dm' as const,
          conversationId: params.conversationId,
        };
        return context;
      }

      // Try to extract from pathname - same logic as web
      const dmMatch = pathname.match(/\/messages\/([^\/]+)/);
      if (dmMatch) {
        const address = dmMatch[1];
        const conversationId = `${address}/${address}`;
        const context = { type: 'dm' as const, conversationId };
        return context;
      }

      // For /messages route without specific conversation
      if (pathname.includes('/messages')) {
        const context = { type: 'dm' as const, conversationId: 'general' };
        return context;
      }
    }

    // Space routes (handle both /space/ and /spaces/) - same logic as web
    if (pathname.includes('/space/') || pathname.includes('/spaces/')) {
      // Try to get from params first
      if (params.spaceId) {
        const context = {
          type: 'space' as const,
          spaceId: params.spaceId,
          channelId: params.channelId,
        };
        return context;
      }

      // Try to extract from pathname - same logic as web
      const spaceMatch = pathname.match(/\/spaces?\/([^\/]+)/);
      if (spaceMatch) {
        const channelMatch = pathname.match(/\/([^\/]+)$/); // Last segment is likely the channel
        const context = {
          type: 'space' as const,
          spaceId: spaceMatch[1],
          channelId: channelMatch?.[1],
        };
        return context;
      }
    }

    // Default fallback - same as web
    const context = { type: 'space' as const, spaceId: 'default' };
    return context;
  }, [location.pathname, params]);
};

// Same helper functions as web - no changes needed
export const getContextDisplayName = (context: SearchContext): string => {
  switch (context.type) {
    case 'space':
      return t`Search in this Space`;
    case 'dm':
      return t`Search here`;
  }
};

export const getContextScope = (context: SearchContext): string => {
  switch (context.type) {
    case 'space':
      return context.channelId ? 'channel' : 'space';
    case 'dm':
      return 'dm';
  }
};
