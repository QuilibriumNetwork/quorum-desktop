import React from 'react';
import { SearchResult } from '../../db/messages';
import { Icon, FlexBetween, FlexRow, Container, Text } from '../primitives';
import { TouchAwareListItem } from '../ui';
import {
  useSearchResultHighlight,
  useSearchResultFormatting,
  BatchSearchResultDisplayData,
} from '../../hooks';
import { stripMarkdownAndMentions } from '../../utils/markdownStripping';
import './SearchResultItem.scss';

interface SearchResultItemProps {
  result: SearchResult;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  highlightTerms: (text: string) => string;
  className?: string;
  searchTerms: string[];
  index: number;
  displayData?: BatchSearchResultDisplayData;
  compactDate?: boolean;
}

// DM Search Result Component
const DMSearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onNavigate,
  highlightTerms,
  className,
  searchTerms,
  displayData,
  compactDate = false,
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

  // Strip markdown and mentions for clean display
  const cleanSnippet = stripMarkdownAndMentions(contextualSnippet);

  const { formattedDate, handleClick } = useSearchResultFormatting({
    message,
    onNavigate,
    compactDate,
  });

  return (
    <TouchAwareListItem
      className={`search-result-item ${className || ''}`}
      onClick={handleClick}
      tabIndex={-1}
    >
      <FlexBetween className="result-header">
        <FlexRow className="result-meta min-w-0">
          {icon && (
            <Container
              className="result-user-profile-image flex-shrink-0"
              style={{ backgroundImage: `url(${icon})` }}
            />
          )}
          <Text className="result-channel mr-2 truncate-channel-name flex-shrink min-w-0">{channelName}</Text>
        </FlexRow>
        <FlexRow className="result-meta flex-shrink-0 whitespace-nowrap">
          <Icon name="calendar-alt" className="result-date-icon flex-shrink-0" />
          <Text className="result-date">{formattedDate}</Text>
        </FlexRow>
      </FlexBetween>

      <Container className="result-content">
        <Container
          className="result-text"
          dangerouslySetInnerHTML={{
            __html: highlightTerms(cleanSnippet),
          }}
        />
      </Container>
    </TouchAwareListItem>
  );
};

// Space Search Result Component
const SpaceSearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onNavigate,
  highlightTerms,
  className,
  searchTerms,
  displayData,
  compactDate = false,
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

  // Strip markdown and mentions for clean display
  const cleanSnippet = stripMarkdownAndMentions(contextualSnippet);

  const { formattedDate, messageTypeIcon, handleClick } =
    useSearchResultFormatting({
      message,
      onNavigate,
      compactDate,
    });

  return (
    <TouchAwareListItem
      className={`search-result-item ${className || ''}`}
      onClick={handleClick}
      tabIndex={-1}
    >
      <FlexBetween className="result-header">
        <FlexRow className="result-meta min-w-0">
          <Icon name={messageTypeIcon} className="result-type-icon flex-shrink-0" />
          <Text className="result-channel mr-2 truncate-channel-name flex-shrink min-w-0">{channelName}</Text>
          <Icon name="user" className="result-user-icon flex-shrink-0" />
          <Text className="result-sender truncate-user-name flex-shrink min-w-0">{displayName}</Text>
        </FlexRow>
        <FlexRow className="result-meta flex-shrink-0 whitespace-nowrap">
          <Icon name="calendar-alt" className="result-date-icon flex-shrink-0" />
          <Text className="result-date">{formattedDate}</Text>
        </FlexRow>
      </FlexBetween>

      <Container className="result-content">
        <Container
          className="result-text"
          dangerouslySetInnerHTML={{
            __html: highlightTerms(cleanSnippet),
          }}
        />
      </Container>
    </TouchAwareListItem>
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
