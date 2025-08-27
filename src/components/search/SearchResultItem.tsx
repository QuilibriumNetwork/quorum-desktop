import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHashtag,
  faUser,
  faCalendarAlt,
} from '@fortawesome/free-solid-svg-icons';
import { t } from '@lingui/core/macro';
import { SearchResult } from '../../db/messages';
import { Message } from '../../api/quorumApi';
import { useUserInfo } from '../../hooks/queries/userInfo/useUserInfo';
import { useSpace } from '../../hooks/queries/space/useSpace';
import './SearchResultItem.scss';
import { useMessageDB } from '../context/MessageDB';
import { DefaultImages } from '../../utils';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

interface SearchResultItemProps {
  result: SearchResult;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  highlightTerms: (text: string) => string;
  className?: string;
  searchTerms: string[];
}

// Component for DM search results
const DMSearchResultItem: React.FC<SearchResultItemProps> =({
  result,
  onNavigate,
  highlightTerms,
  className,
  searchTerms,
}) => {
  const { message } = result;
  const { messageDB } = useMessageDB();
  const [icon, setIcon] = React.useState<string >(DefaultImages.UNKNOWN_USER);
  const [displayName, setDisplayName] = React.useState<string>(t`Unknown User`);
  const { currentPasskeyInfo } = usePasskeysContext();

  React.useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        // For DMs, conversationId format is spaceId/channelId
        const conversationId = `${message.content.senderId}/${message.content.senderId}`;
        const { conversation } = await messageDB.getConversation({
          conversationId
        });
        if (conversation) {
          setIcon(conversation.icon);
          setDisplayName(conversation.displayName);
        }
      } catch (error) {
        console.error('Failed to fetch conversation:', error);
      }
    };
    if (message.content.senderId !== currentPasskeyInfo!.address) {
      fetchUserInfo();
    } else if (currentPasskeyInfo && currentPasskeyInfo.pfpUrl && currentPasskeyInfo.displayName) {
      setIcon(currentPasskeyInfo.pfpUrl);
      setDisplayName(currentPasskeyInfo.displayName);
    }
  }, [messageDB, message.spaceId, message.channelId]);

  return (
    <SearchResultItemContent
      {...result}
      onNavigate={onNavigate}
      highlightTerms={highlightTerms}
      className={className}
      displayName={displayName}
      icon={icon}
      spaceName={t`Direct Message`}
      channelName={displayName} // Use sender name for both
      isDM={true}
      searchTerms={searchTerms}
    />
  );
};

// Component for Space search results
const SpaceSearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onNavigate,
  highlightTerms,
  className,
  searchTerms,
}) => {
  const { message } = result;

  // Fetch user info for the sender
  const { data: userInfo } = useUserInfo({
    address: message.content.senderId,
  });

  // Fetch space info
  const { data: spaceInfo } = useSpace({
    spaceId: message.spaceId,
  });

  // Get channel name from space data
  const channel = spaceInfo?.groups
    .find((g) => g.channels.find((c) => c.channelId === message.channelId))
    ?.channels.find((c) => c.channelId === message.channelId);

  const displayName =
    userInfo.display_name ||
    t`Unknown User`;
  const spaceName = spaceInfo?.spaceName || t`Unknown Space`;
  const channelName = channel?.channelName || message.channelId;

  return (
    <SearchResultItemContent
      {...result}
      onNavigate={onNavigate}
      highlightTerms={highlightTerms}
      className={className}
      displayName={displayName}
      spaceName={spaceName}
      channelName={channelName}
      isDM={false}
      searchTerms={searchTerms}
    />
  );
};

// Main component that delegates to appropriate sub-component
export const SearchResultItem: React.FC<SearchResultItemProps> = (props) => {
  const { result } = props;
  const { message } = result;

  // Detect if this is a DM message (spaceId === channelId indicates DM)
  const isDM = message.spaceId === message.channelId;

  if (isDM) {
    return <DMSearchResultItem {...props} />;
  } else {
    return <SpaceSearchResultItem {...props} />;
  }
};

// Shared content component
interface SearchResultItemContentProps extends SearchResult {
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  highlightTerms: (text: string) => string;
  className?: string;
  displayName: string;
  spaceName: string;
  channelName: string;
  isDM: boolean;
  icon?: string;
  searchTerms: string[];
}

const SearchResultItemContent: React.FC<SearchResultItemContentProps> = ({
  message,
  score,
  highlights,
  onNavigate,
  highlightTerms,
  className,
  displayName,
  icon,
  spaceName,
  channelName,
  isDM,
  searchTerms,
}) => {
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return t`Yesterday`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getMessageText = (message: Message): string => {
    if (message.content.type === 'post') {
      const content = message.content.text;
      return Array.isArray(content) ? content.join(' ') : content;
    }
    if (message.content.type === 'event') {
      return message.content.text;
    }
    return '';
  };

  const generateContextualSnippet = (
    text: string,
    searchTerms: string[],
    contextWords: number = 12,
    maxLength: number = 200
  ): string => {
    if (!searchTerms.length || !text.trim()) {
      return text.length > maxLength
        ? text.substring(0, maxLength) + '...'
        : text;
    }

    // Split text into words
    const words = text.split(/\s+/);

    // Find the first occurrence of any search term
    let foundIndex = -1;

    for (const term of searchTerms) {
      const termLower = term.toLowerCase();
      for (let i = 0; i < words.length; i++) {
        if (words[i].toLowerCase().includes(termLower)) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex !== -1) break;
    }

    // If no terms found, return truncated text from beginning
    if (foundIndex === -1) {
      return text.length > maxLength
        ? text.substring(0, maxLength) + '...'
        : text;
    }

    // Calculate snippet boundaries
    const startIndex = Math.max(0, foundIndex - contextWords);
    const endIndex = Math.min(words.length, foundIndex + contextWords + 1);

    // Extract snippet
    let snippet = words.slice(startIndex, endIndex).join(' ');

    // Add ellipsis if we're not at the start/end
    if (startIndex > 0) {
      snippet = '...' + snippet;
    }
    if (endIndex < words.length) {
      snippet = snippet + '...';
    }

    // If snippet is still too long, truncate it
    if (snippet.length > maxLength) {
      snippet = snippet.substring(0, maxLength - 3) + '...';
    }

    return snippet;
  };

  const getMessageTypeIcon = (message: Message) => {
    switch (message.content.type) {
      case 'post':
        return faHashtag;
      case 'event':
        return faCalendarAlt;
      default:
        return faHashtag;
    }
  };

  const handleClick = () => {
    onNavigate(message.spaceId, message.channelId, message.messageId);
  };

  const messageText = getMessageText(message);
  const contextualSnippet = generateContextualSnippet(messageText, searchTerms);

  return (
    <div
      className={`search-result-item ${className || ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="result-header">
        <div className="result-meta">
          {isDM && icon && <div className="result-user-profile-image" style={{ backgroundImage: `url(${icon})` }} />}
          {!isDM && <FontAwesomeIcon
            icon={isDM ? faUser : getMessageTypeIcon(message)}
            className="result-type-icon"
          />}
          <span className="result-channel mr-2">{channelName}</span>

          {!isDM && (
            <>
              <FontAwesomeIcon icon={faUser} className="result-user-icon" />
              <span className=" result-sender">{displayName}</span>
            </>
          )}
        </div>
      </div>

      <div className="result-content">
        <div
          className="result-text"
          dangerouslySetInnerHTML={{
            __html: highlightTerms(contextualSnippet),
          }}
        />
      </div>

      <div className="result-footer">
        <span className="result-date">{formatDate(message.createdDate)}</span>
      </div>
    </div>
  );
};
