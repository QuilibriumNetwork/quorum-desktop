import React, { useState, useEffect } from 'react';
import { SearchResult } from '../../db/messages';
import { Icon, FlexBetween, FlexRow, Container, Text } from '../primitives';
import {
  useSearchResultHighlight,
  useSearchResultFormatting,
  BatchSearchResultDisplayData,
} from '../../hooks';
import './SearchResultItem.scss';

interface SearchResultItemProps {
  result: SearchResult;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  highlightTerms: (text: string) => string;
  className?: string;
  searchTerms: string[];
  index: number;
  displayData?: BatchSearchResultDisplayData;
}

// DM Search Result Component
const DMSearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onNavigate,
  highlightTerms,
  className,
  searchTerms,
  index,
  displayData,
}) => {
  const { message } = result;

  // Use batch-loaded display data instead of individual hooks
  const channelName =
    displayData?.channelName ||
    (displayData?.isLoading ? 'Loading...' : 'Unknown');
  const icon = displayData?.icon;

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
        <FlexRow className="result-meta">
          <Icon name="calendar-alt" className="result-date-icon" />
          <Text className="result-date">{formattedDate}</Text>
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
  displayData,
}) => {
  const { message } = result;

  // Use batch-loaded display data instead of individual hooks
  const displayName =
    displayData?.displayName ||
    (displayData?.isLoading ? 'Loading...' : 'Unknown User');
  const channelName =
    displayData?.channelName ||
    (displayData?.isLoading ? 'Loading...' : 'Unknown Channel');

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
        <FlexRow className="result-meta">
          <Icon name="calendar-alt" className="result-date-icon" />
          <Text className="result-date">{formattedDate}</Text>
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
