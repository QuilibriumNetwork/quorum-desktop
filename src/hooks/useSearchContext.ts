import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { SearchContext } from '../db/db';

interface RouteParams {
  spaceId?: string;
  channelId?: string;
  conversationId?: string;
  address?: string; // For DM routes
}

export const useSearchContext = (): SearchContext => {
  const location = useLocation();
  const params = useParams<RouteParams>();

  return useMemo((): SearchContext => {
    const pathname = location.pathname;

    // Direct message routes
    if (
      pathname.includes('/dm/') ||
      pathname.includes('/direct/') ||
      pathname.includes('/messages/')
    ) {
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

      // Try to extract from pathname
      const dmMatch = pathname.match(/\/(?:dm|direct|messages)\/([^\/]+)/);
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

    // Space routes (handle both /space/ and /spaces/)
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

      // Try to extract from pathname
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

    // Default fallback - could be improved based on app structure
    const context = { type: 'space' as const, spaceId: 'default' };
    return context;
  }, [location.pathname, params]);
};

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
