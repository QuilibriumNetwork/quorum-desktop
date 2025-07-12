import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { SearchContext } from '../db/messages';

interface RouteParams {
  spaceId?: string;
  channelId?: string;
  conversationId?: string;
}

export const useSearchContext = (): SearchContext => {
  const location = useLocation();
  const params = useParams<RouteParams>();

  return useMemo((): SearchContext => {
    const pathname = location.pathname;
    
    // Direct message routes
    if (pathname.includes('/dm/') || pathname.includes('/direct/')) {
      // Try to get from params first
      if (params.conversationId) {
        return { type: 'dm', conversationId: params.conversationId };
      }
      
      // Try to extract from pathname
      const dmMatch = pathname.match(/\/(?:dm|direct)\/([^\/]+)/);
      if (dmMatch) {
        return { type: 'dm', conversationId: dmMatch[1] };
      }
    }
    
    // Space routes
    if (pathname.includes('/space/')) {
      // Try to get from params first
      if (params.spaceId) {
        return { type: 'space', spaceId: params.spaceId, channelId: params.channelId };
      }
      
      // Try to extract from pathname
      const spaceMatch = pathname.match(/\/space\/([^\/]+)/);
      if (spaceMatch) {
        const channelMatch = pathname.match(/\/channel\/([^\/]+)/);
        return { 
          type: 'space', 
          spaceId: spaceMatch[1],
          channelId: channelMatch?.[1]
        };
      }
    }
    
    // Default fallback - could be improved based on app structure
    return { type: 'space', spaceId: 'default' };
  }, [location.pathname, params]);
};

export const getContextDisplayName = (context: SearchContext): string => {
  switch (context.type) {
    case 'space':
      if (context.channelId) {
        return `Search in #${context.channelId}`;
      }
      return `Search in space`;
    case 'dm':
      return 'Search in direct messages';
    default:
      return 'Search messages';
  }
};

export const getContextScope = (context: SearchContext): string => {
  switch (context.type) {
    case 'space':
      return context.channelId ? 'channel' : 'space';
    case 'dm':
      return 'dm';
    default:
      return 'global';
  }
};