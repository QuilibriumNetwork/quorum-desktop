import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as moment from 'moment-timezone';
import {
  shouldShowDateSeparator,
  getStartOfDay,
  getDateLabel,
  groupMessagesByDay,
  generateListWithSeparators,
} from '../../../utils/messageGrouping';
import { Message } from '../../../api/quorumApi';

// Mock message helper
const createMockMessage = (timestamp: number, messageId: string): Message => ({
  channelId: 'channel-1',
  spaceId: 'space-1',
  messageId,
  digestAlgorithm: 'test',
  nonce: 'test',
  createdDate: timestamp,
  modifiedDate: timestamp,
  lastModifiedHash: 'test',
  content: {
    type: 'post',
    text: 'Test message',
  } as any,
  reactions: [],
  mentions: {
    mentions: [],
    channels: [],
    roles: [],
    everyone: false,
  },
});

describe('messageGrouping utilities', () => {
  const testTimezone = 'America/New_York';

  beforeEach(() => {
    // Mock Intl.DateTimeFormat to return consistent timezone
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: testTimezone,
    } as any);
  });

  const now = moment.tz(
    '2024-11-10 15:30:00',
    'YYYY-MM-DD HH:mm:ss',
    testTimezone
  );
  const today = now.valueOf();
  const yesterday = now.clone().subtract(1, 'day').valueOf();
  const twoDaysAgo = now.clone().subtract(2, 'days').valueOf();
  const lastWeek = now.clone().subtract(6, 'days').valueOf();
  const lastMonth = now.clone().subtract(1, 'month').valueOf();

  describe('getStartOfDay', () => {
    it('should return start of day timestamp', () => {
      const timestamp = moment
        .tz('2024-11-10 15:30:45', 'YYYY-MM-DD HH:mm:ss', testTimezone)
        .valueOf();
      const expected = moment
        .tz('2024-11-10 00:00:00', 'YYYY-MM-DD HH:mm:ss', testTimezone)
        .valueOf();

      expect(getStartOfDay(timestamp)).toBe(expected);
    });
  });

  describe('shouldShowDateSeparator', () => {
    it('should show separator for first message', () => {
      const message = createMockMessage(today, 'msg1');
      expect(shouldShowDateSeparator(message, null)).toBe(true);
    });

    it('should not show separator for same day messages', () => {
      const msg1 = createMockMessage(today, 'msg1');
      const msg2 = createMockMessage(today + 1000, 'msg2'); // 1 second later, same day

      expect(shouldShowDateSeparator(msg2, msg1)).toBe(false);
    });

    it('should show separator for different day messages', () => {
      const msg1 = createMockMessage(yesterday, 'msg1');
      const msg2 = createMockMessage(today, 'msg2');

      expect(shouldShowDateSeparator(msg2, msg1)).toBe(true);
    });
  });

  describe('getDateLabel', () => {
    it('should return formatted date labels in "MMMM D, YYYY" format', () => {
      // Test the format pattern
      const label = getDateLabel(today);
      expect(typeof label).toBe('string');
      expect(label).toMatch(/^[A-Za-z]+ \d{1,2}, \d{4}$/); // "October 15, 2025" format

      // Test the function doesn't throw
      expect(() => getDateLabel(today)).not.toThrow();
      expect(() => getDateLabel(yesterday)).not.toThrow();
      expect(() => getDateLabel(lastWeek)).not.toThrow();
      expect(() => getDateLabel(lastMonth)).not.toThrow();
    });

    it('should handle different timestamps correctly', () => {
      const timestamp1 = moment
        .tz('2024-01-15 12:00:00', 'YYYY-MM-DD HH:mm:ss', testTimezone)
        .valueOf();
      const timestamp2 = moment
        .tz('2025-12-25 18:30:00', 'YYYY-MM-DD HH:mm:ss', testTimezone)
        .valueOf();

      expect(getDateLabel(timestamp1)).toBe('January 15, 2024');
      expect(getDateLabel(timestamp2)).toBe('December 25, 2025');
    });
  });

  describe('groupMessagesByDay', () => {
    it('should handle empty message list', () => {
      expect(groupMessagesByDay([])).toEqual([]);
    });

    it('should group messages by day correctly', () => {
      const messages = [
        createMockMessage(yesterday, 'msg1'),
        createMockMessage(yesterday + 1000, 'msg2'),
        createMockMessage(today, 'msg3'),
        createMockMessage(today + 2000, 'msg4'),
      ];

      const groups = groupMessagesByDay(messages);

      expect(groups).toHaveLength(2);
      expect(groups[0].messages).toHaveLength(2);
      expect(groups[1].messages).toHaveLength(2);
      expect(groups[0].messages[0].messageId).toBe('msg1');
      expect(groups[0].messages[1].messageId).toBe('msg2');
      expect(groups[1].messages[0].messageId).toBe('msg3');
      expect(groups[1].messages[1].messageId).toBe('msg4');
    });

    it('should handle single message', () => {
      const messages = [createMockMessage(today, 'msg1')];
      const groups = groupMessagesByDay(messages);

      expect(groups).toHaveLength(1);
      expect(groups[0].messages).toHaveLength(1);
      expect(groups[0].messages[0].messageId).toBe('msg1');
    });
  });

  describe('generateListWithSeparators', () => {
    it('should handle empty message list', () => {
      expect(generateListWithSeparators([])).toEqual([]);
    });

    it('should generate list with separators correctly', () => {
      const messages = [
        createMockMessage(yesterday, 'msg1'),
        createMockMessage(today, 'msg2'),
        createMockMessage(today + 1000, 'msg3'),
      ];

      const items = generateListWithSeparators(messages);

      expect(items).toHaveLength(5); // 2 separators + 3 messages
      expect(items[0].type).toBe('dateSeparator');
      expect(items[1].type).toBe('message');
      expect(items[2].type).toBe('dateSeparator');
      expect(items[3].type).toBe('message');
      expect(items[4].type).toBe('message');

      // Check message data is preserved
      if (items[1].type === 'message') {
        expect(items[1].data.messageId).toBe('msg1');
      }
      if (items[3].type === 'message') {
        expect(items[3].data.messageId).toBe('msg2');
      }
      if (items[4].type === 'message') {
        expect(items[4].data.messageId).toBe('msg3');
      }
    });

    it('should not add separator between same day messages', () => {
      const messages = [
        createMockMessage(today, 'msg1'),
        createMockMessage(today + 1000, 'msg2'),
      ];

      const items = generateListWithSeparators(messages);

      expect(items).toHaveLength(3); // 1 separator + 2 messages
      expect(items[0].type).toBe('dateSeparator');
      expect(items[1].type).toBe('message');
      expect(items[2].type).toBe('message');
    });
  });
});
