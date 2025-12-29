/**
 * Mock conversation generation utilities for development and testing
 * Used to test Direct Messages list with many contacts
 */

import { getMockName } from './mockNames';
import type { Conversation } from '../../api/quorumApi';

// Sample message previews for realistic mock data
const MOCK_PREVIEWS = [
  // English
  'Hey, how are you doing?',
  'Did you see the latest update?',
  'Thanks for the help earlier!',
  'Let me know when you are free',
  'That sounds great!',

  // Spanish
  '¿Cómo estás? Todo bien por aquí',
  '¡Hola! ¿Quedamos mañana?',
  'Perfecto, muchas gracias',

  // French
  'Salut ! Comment ça va ?',
  "C'est une bonne idée !",
  'À demain, bonne soirée',

  // German
  'Wie geht es dir?',
  'Das klingt super!',
  'Bis später, tschüss!',

  // Portuguese
  'Tudo bem? Já viste isso?',
  'Obrigado pela ajuda!',

  // Italian
  'Ciao! Come stai oggi?',
  'Perfetto, grazie mille!',

  // Japanese
  'お元気ですか？',
  'ありがとうございます！',
  '明日会いましょう',
  'それはいいですね！',

  // Chinese (Simplified)
  '你好！最近怎么样？',
  '谢谢你的帮助！',
  '明天见！',

  // Korean
  '안녕하세요! 잘 지내세요?',
  '감사합니다!',
  '내일 봐요!',

  // Russian
  'Привет! Как дела?',
  'Спасибо за помощь!',
  'До завтра!',

  // Arabic
  'مرحباً! كيف حالك؟',
  'شكراً جزيلاً!',
  'إلى اللقاء!',

  // Hindi
  'नमस्ते! कैसे हो?',
  'धन्यवाद!',
  'कल मिलते हैं!',

  // Greek
  'Γεια σου! Τι κάνεις;',
  'Ευχαριστώ πολύ!',

  // Hebrew
  'שלום! מה נשמע?',
  'תודה רבה!',

  // Thai
  'สวัสดี! สบายดีไหม?',
  'ขอบคุณครับ!',
];

export interface MockConversation extends Conversation {
  preview?: string;
  previewIcon?: string;
}

/**
 * Generate mock conversations with diverse names and avatars
 * Uses cycling arrays to ensure variety without performance impact
 */
export function generateMockConversations(count: number): MockConversation[] {
  const mockConversations: MockConversation[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    // Generate timestamps spread over the last 30 days
    const daysAgo = Math.floor(Math.random() * 30);
    const hoursAgo = Math.floor(Math.random() * 24);
    const timestamp = now - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000;

    // Some conversations are unread (random 30% chance)
    const isUnread = Math.random() < 0.3;
    const lastReadTimestamp = isUnread ? timestamp - 1000 : timestamp + 1000;

    mockConversations.push({
      conversationId: `mock_conv_${i}/mock_channel_${i}`,
      type: 'direct',
      timestamp,
      address: `mock_contact_${i}`,
      icon: '', // Empty to trigger initials fallback in UserAvatar
      displayName: getMockName(i),
      lastReadTimestamp,
      preview: MOCK_PREVIEWS[i % MOCK_PREVIEWS.length],
    });
  }

  // Sort by timestamp descending (newest first)
  return mockConversations.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Check if mock conversations are enabled in development
 * Controlled by localStorage or URL parameter (?users=N)
 */
export function isMockConversationsEnabled(): boolean {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  return (
    localStorage?.getItem('debug_mock_conversations') === 'true' ||
    new URLSearchParams(window.location?.search || '').get('users') !== null
  );
}

/**
 * Get mock conversation count from URL parameter or localStorage
 */
export function getMockConversationCount(): number {
  return parseInt(
    new URLSearchParams(window.location?.search || '').get('users') ||
      localStorage?.getItem('debug_mock_conversation_count') ||
      '50'
  );
}
