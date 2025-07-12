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
    
    console.log('useSearchContext: pathname:', pathname, 'params:', params);
    
    // Direct message routes
    if (pathname.includes('/dm/') || pathname.includes('/direct/') || pathname.includes('/messages/')) {
      // Try to get from params first
      if (params.conversationId) {
        const context = { type: 'dm' as const, conversationId: params.conversationId };
        console.log('useSearchContext: returning DM context (from params):', context);
        return context;
      }
      
      // Try to extract from pathname
      const dmMatch = pathname.match(/\/(?:dm|direct|messages)\/([^\/]+)/);
      if (dmMatch) {
        const context = { type: 'dm' as const, conversationId: dmMatch[1] };
        console.log('useSearchContext: returning DM context (from path):', context);
        return context;
      }
      
      // For /messages route without specific conversation
      if (pathname.includes('/messages')) {
        const context = { type: 'dm' as const, conversationId: 'general' };
        console.log('useSearchContext: returning general DM context:', context);
        return context;
      }
    }
    
    // Space routes (handle both /space/ and /spaces/)
    if (pathname.includes('/space/') || pathname.includes('/spaces/')) {
      // Try to get from params first
      if (params.spaceId) {
        const context = { type: 'space' as const, spaceId: params.spaceId, channelId: params.channelId };
        console.log('useSearchContext: returning space context (from params):', context);
        return context;
      }
      
      // Try to extract from pathname
      const spaceMatch = pathname.match(/\/spaces?\/([^\/]+)/);
      if (spaceMatch) {
        const channelMatch = pathname.match(/\/([^\/]+)$/); // Last segment is likely the channel
        const context = { 
          type: 'space' as const, 
          spaceId: spaceMatch[1],
          channelId: channelMatch?.[1]
        };
        console.log('useSearchContext: returning space context (from path):', context);
        return context;
      }
    }
    
    // Default fallback - could be improved based on app structure
    const context = { type: 'space' as const, spaceId: 'default' };
    console.log('useSearchContext: returning default context:', context);
    return context;
  }, [location.pathname, params]);
};

export const getContextDisplayName = (context: SearchContext): string => {
  switch (context.type) {
    case 'space':
      return `Search in this Space`;
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