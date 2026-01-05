import * as moment from 'moment-timezone';
import { Message } from '../api/quorumApi';

export interface MessageGroup {
  date: number; // Start of day timestamp
  messages: Message[];
  label: string; // "Today", "Yesterday", etc.
}

/**
 * Groups messages by calendar day for date separator insertion.
 *
 * This function takes an array of messages and groups them by calendar day,
 * generating appropriate labels for each group. The grouping is timezone-aware
 * and uses calendar days (not 24-hour periods).
 *
 * @param messages - Array of messages sorted by createdDate (oldest first)
 * @returns Array of MessageGroup objects with date separators
 */
export function groupMessagesByDay(messages: Message[]): MessageGroup[] {
  if (!messages.length) return [];

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const message of messages) {
    const messageDay = getStartOfDay(message.createdDate);

    if (!currentGroup || currentGroup.date !== messageDay) {
      currentGroup = {
        date: messageDay,
        messages: [message],
        label: getDateLabel(messageDay),
      };
      groups.push(currentGroup);
    } else {
      currentGroup.messages.push(message);
    }
  }

  return groups;
}

/**
 * Determines if a date separator should be shown between two messages.
 *
 * @param current - Current message
 * @param previous - Previous message (null if current is first)
 * @returns True if a date separator should be displayed before current message
 */
export function shouldShowDateSeparator(
  current: Message,
  previous: Message | null
): boolean {
  if (!previous) return true; // Always show separator before first message

  const currentDay = getStartOfDay(current.createdDate);
  const previousDay = getStartOfDay(previous.createdDate);

  return currentDay !== previousDay;
}

// 5 minutes in milliseconds - messages within this window can be grouped
const MESSAGE_GROUP_TIME_THRESHOLD = 5 * 60 * 1000;

/**
 * Determines if a message should display a compact header (no avatar/username).
 * Messages are grouped when from same sender, within time threshold, and no separators between.
 *
 * @param current - Current message
 * @param previous - Previous message (null if current is first)
 * @param hasDateSeparator - Whether a date separator appears before current message
 * @param hasNewMessagesSeparator - Whether a "new messages" separator appears before current message
 * @returns True if message should render in compact mode
 */
export function shouldShowCompactHeader(
  current: Message,
  previous: Message | null,
  hasDateSeparator: boolean,
  hasNewMessagesSeparator: boolean
): boolean {
  // Never compact if no previous message or separators exist
  if (!previous || hasDateSeparator || hasNewMessagesSeparator) return false;

  // Never compact system messages (join/leave/kick)
  if (['join', 'leave', 'kick'].includes(current.content.type)) return false;
  if (['join', 'leave', 'kick'].includes(previous.content.type)) return false;

  // Never compact if current message is a reply
  if ((current.content as any).repliesToMessageId) return false;

  // Must be same sender
  const currentSenderId = (current.content as any).senderId;
  const previousSenderId = (previous.content as any).senderId;
  if (!currentSenderId || !previousSenderId || currentSenderId !== previousSenderId) return false;

  // Must be within time threshold
  const timeDiff = current.createdDate - previous.createdDate;
  return timeDiff >= 0 && timeDiff <= MESSAGE_GROUP_TIME_THRESHOLD;
}

/**
 * Gets the start of day timestamp for a given date.
 * Uses the user's timezone for accurate calendar day calculations.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Start of day timestamp in milliseconds
 */
export function getStartOfDay(timestamp: number): number {
  return moment
    .tz(timestamp, Intl.DateTimeFormat().resolvedOptions().timeZone)
    .startOf('day')
    .valueOf();
}

/**
 * Generates a human-readable date label for a timestamp.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string in "Month DD, YYYY" format (e.g. "October 15, 2025")
 */
export function getDateLabel(timestamp: number): string {
  const time = moment.tz(
    timestamp,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  // Always use the full date format: "October 15, 2025"
  return time.format('MMMM D, YYYY');
}

/**
 * Utility type for representing a list item that can be either a message or date separator
 */
export type MessageListItem =
  | { type: 'message'; data: Message; index: number }
  | {
      type: 'dateSeparator';
      data: { date: number; label: string; id: string };
    };

/**
 * Transforms a flat message array into a list of items including date separators.
 * This is useful for virtualized lists that need a flat array structure.
 *
 * @param messages - Array of messages sorted by createdDate
 * @returns Array of MessageListItem objects including separators
 */
export function generateListWithSeparators(
  messages: Message[]
): MessageListItem[] {
  if (!messages.length) return [];

  const items: MessageListItem[] = [];
  let previousMessage: Message | null = null;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    // Add date separator if needed
    if (shouldShowDateSeparator(message, previousMessage)) {
      const startOfDay = getStartOfDay(message.createdDate);
      items.push({
        type: 'dateSeparator',
        data: {
          date: startOfDay,
          label: getDateLabel(startOfDay),
          id: `separator-${startOfDay}`,
        },
      });
    }

    // Add the message
    items.push({
      type: 'message',
      data: message,
      index: i,
    });

    previousMessage = message;
  }

  return items;
}
