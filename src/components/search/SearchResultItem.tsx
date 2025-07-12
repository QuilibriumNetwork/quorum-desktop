import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHashtag, faUser, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { SearchResult } from '../../db/messages';
import { Message } from '../../api/quorumApi';
import './SearchResultItem.scss';

interface SearchResultItemProps {
  result: SearchResult;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  highlightTerms: (text: string) => string;
  className?: string;
}

export const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onNavigate,
  highlightTerms,
  className,
}) => {
  const { message, score, highlights } = result;

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
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
            icon={getMessageTypeIcon(message)} 
            className="result-type-icon"
          />
          <span className="result-channel">
            #{message.channelId}
          </span>
          <span className="result-separator">•</span>
          <FontAwesomeIcon 
            icon={faUser} 
            className="result-user-icon"
          />
          <span className="result-sender">
            {message.content.senderId}
          </span>
          <span className="result-separator">•</span>
          <span className="result-date">
            {formatDate(message.createdDate)}
          </span>
        </div>
        <div className="result-score">
          {Math.round(score * 100)}%
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
      
      {highlights.length > 0 && (
        <div className="result-highlights">
          <span className="highlights-label">Matches:</span>
          {highlights.slice(0, 3).map((term, index) => (
            <span key={index} className="highlight-term">
              {term}
            </span>
          ))}
          {highlights.length > 3 && (
            <span className="highlights-more">
              +{highlights.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
};