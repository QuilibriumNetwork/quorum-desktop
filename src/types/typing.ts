/**
 * Typing indicator wire types and scope helpers.
 *
 * TypingMessage is an ephemeral control message that rides the existing
 * encrypted transport (Double Ratchet for DMs, Triple Ratchet hub broadcast
 * for spaces). Intercepted in MessageService before saveMessage — never
 * written to IndexedDB, never added to the sync manifest.
 */

export type TypingMessageType = 'typing-start' | 'typing-stop';

/** Wire format. Mirrors the flat shape of delivery-ack / read-ack control messages. */
export interface TypingMessage {
  type: TypingMessageType;
  senderId: string;
  scope: 'dm' | 'space';
  spaceId?: string;
  channelId?: string;
  threadId?: string;
  timestamp: number;
}

/** Discriminated union for callers. Keeps the rendering side honest about which fields apply. */
export type TypingScope =
  | { kind: 'dm'; address: string }
  | { kind: 'space-channel'; spaceId: string; channelId: string }
  | { kind: 'thread'; spaceId: string; channelId: string; threadId: string };

/** Stable string key per scope, used as a Map key. */
export function scopeKey(scope: TypingScope): string {
  switch (scope.kind) {
    case 'dm':
      return `dm:${scope.address}`;
    case 'space-channel':
      return `sc:${scope.spaceId}:${scope.channelId}`;
    case 'thread':
      return `th:${scope.spaceId}:${scope.channelId}:${scope.threadId}`;
  }
}

/** Convenience: derive a TypingScope from an incoming TypingMessage's fields. */
export function scopeFromMessage(msg: TypingMessage): TypingScope | null {
  if (msg.scope === 'dm') {
    return { kind: 'dm', address: msg.senderId };
  }
  if (msg.scope === 'space' && msg.spaceId && msg.channelId) {
    if (msg.threadId) {
      return { kind: 'thread', spaceId: msg.spaceId, channelId: msg.channelId, threadId: msg.threadId };
    }
    return { kind: 'space-channel', spaceId: msg.spaceId, channelId: msg.channelId };
  }
  return null;
}
