import React, { useState, useEffect } from 'react';
import { SearchResult } from '../../db/messages';
import { Icon, FlexBetween, FlexRow, Container, Text } from '../primitives';
import {
  useSearchResultDisplayDM,
  useSearchResultDisplaySpace,
  useSearchResultHighlight,
  useSearchResultFormatting,
} from '../../hooks';
import './SearchResultItem.scss';

interface SearchResultItemProps {
  result: SearchResult;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  highlightTerms: (text: string) => string;
  className?: string;
  searchTerms: string[];
  index: number; // Add index to enable staggered loading
}

// DM Search Result Component
const DMSearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onNavigate,
  highlightTerms,
  className,
  searchTerms,
  index,
}) => {
  const { message } = result;
  // DM-specific display logic (restored)
  const { channelName, icon } = useSearchResultDisplayDM({
    result,
  });

  const { contextualSnippet } = useSearchResultHighlight({
    message,
    searchTerms,
  });

  const { formattedDate, handleClick, handleKeyDown } =
    useSearchResultFormatting({
      message,
      onNavigate,
    });

  return (
    <Container
      className={`search-result-item ${className || ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <FlexBetween className="result-header">
        <FlexRow className="result-meta">
          {icon && (
            <Container
              className="result-user-profile-image"
              style={{ backgroundImage: `url(${icon})` }}
            />
          )}
          <Text className="result-channel mr-2">{channelName}</Text>
        </FlexRow>
      </FlexBetween>

      <Container className="result-content">
        <Container
          className="result-text"
          dangerouslySetInnerHTML={{
            __html: highlightTerms(contextualSnippet),
          }}
        />
      </Container>

      <FlexBetween className="result-footer">
        <Text className="result-date">{formattedDate}</Text>
      </FlexBetween>
    </Container>
  );
};

// Space Search Result Component
const SpaceSearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onNavigate,
  highlightTerms,
  className,
  searchTerms,
  index,
}) => {
  const { message } = result;
  // Space-specific display logic (restored)
  const { displayName, channelName } = useSearchResultDisplaySpace({
    result,
  });

  const { contextualSnippet } = useSearchResultHighlight({
    message,
    searchTerms,
  });

  const { formattedDate, messageTypeIcon, handleClick, handleKeyDown } =
    useSearchResultFormatting({
      message,
      onNavigate,
    });

  return (
    <Container
      className={`search-result-item ${className || ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <FlexBetween className="result-header">
        <FlexRow className="result-meta">
          <Icon name={messageTypeIcon} className="result-type-icon" />
          <Text className="result-channel mr-2">{channelName}</Text>
          <Icon name="user" className="result-user-icon" />
          <Text className="result-sender">{displayName}</Text>
        </FlexRow>
      </FlexBetween>

      <Container className="result-content">
        <Container
          className="result-text"
          dangerouslySetInnerHTML={{
            __html: highlightTerms(contextualSnippet),
          }}
        />
      </Container>

      <FlexBetween className="result-footer">
        <Text className="result-date">{formattedDate}</Text>
      </FlexBetween>
    </Container>
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
