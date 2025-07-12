import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHashtag, faUser, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { t } from '@lingui/core/macro';
import { SearchResult } from '../../db/messages';
import { Message } from '../../api/quorumApi';
import { useUserInfo } from '../../hooks/queries/userInfo/useUserInfo';
import { useSpace } from '../../hooks/queries/space/useSpace';
import './SearchResultItem.scss';

interface SearchResultItemProps {
  result: SearchResult;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  highlightTerms: (text: string) => string;
  className?: string;
}

// Component for DM search results
const DMSearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onNavigate,
  highlightTerms,
  className,
}) => {
  const { message } = result;

  // Fetch user info for the sender
  const { data: userInfo } = useUserInfo({ 
    address: message.content.senderId,
    enabled: !!message.content.senderId 
  });

  const displayName = userInfo?.userProfile?.displayName || userInfo?.userProfile?.display_name || t`Unknown User`;
  
  return <SearchResultItemContent 
    {...result}
    onNavigate={onNavigate}
    highlightTerms={highlightTerms}
    className={className}
    displayName={displayName}
    spaceName={t`Direct Message`}
    channelName={displayName} // Use sender name for both
    isDM={true}
  />;
};

// Component for Space search results
const SpaceSearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onNavigate,
  highlightTerms,
  className,
}) => {
  const { message } = result;

  // Fetch user info for the sender
  const { data: userInfo } = useUserInfo({ 
    address: message.content.senderId,
    enabled: !!message.content.senderId 
  });

  // Fetch space info
  const { data: spaceInfo } = useSpace({ 
    spaceId: message.spaceId
  });

  // Get channel name from space data
  const channel = spaceInfo?.groups
    .find((g) => g.channels.find((c) => c.channelId === message.channelId))
    ?.channels.find((c) => c.channelId === message.channelId);

  const displayName = userInfo?.userProfile?.displayName || userInfo?.userProfile?.display_name || t`Unknown User`;
  const spaceName = spaceInfo?.spaceName || t`Unknown Space`;
  const channelName = channel?.channelName || message.channelId;
  
  return <SearchResultItemContent 
    {...result}
    onNavigate={onNavigate}
    highlightTerms={highlightTerms}
    className={className}
    displayName={displayName}
    spaceName={spaceName}
    channelName={channelName}
    isDM={false}
  />;
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
}

const SearchResultItemContent: React.FC<SearchResultItemContentProps> = ({
  message,
  score,
  highlights,
  onNavigate,
  highlightTerms,
  className,
  displayName,
  spaceName,
  channelName,
  isDM,
}) => {

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const truncatedText = messageText.length > 150 
    ? messageText.substring(0, 150) + '...'
    : messageText;

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
          <FontAwesomeIcon 
            icon={isDM ? faUser : getMessageTypeIcon(message)} 
            className="result-type-icon"
          />
          <span className="result-channel mr-2">
            {channelName}
          </span>
        
          {!isDM && (
            <>
              <FontAwesomeIcon 
                icon={faUser} 
                className="result-user-icon"
              />
              <span className=" result-sender">
                {displayName}
              </span>
            </>
          )}
        </div>
      </div>
      
      <div className="result-content">
        <div 
          className="result-text"
          dangerouslySetInnerHTML={{
            __html: highlightTerms(truncatedText)
          }}
        />
      </div>
      
      <div className="result-footer">
        <span className="result-date">
          {formatDate(message.createdDate)}
        </span>
      </div>
    </div>
  );
};