/**
 * TypingService
 *
 * Manages typing-indicator signaling for DMs, space channels, and threads.
 *
 * Send side: throttled to one typing-start per 5 seconds per scope.
 * Explicit typing-stop sent on send/blur/conversation-close. Privacy
 * gated — if the relevant user setting is OFF, all sends are no-ops.
 *
 * Receive side: maintains an in-memory map of who is currently typing
 * per scope, with an 8-second TTL per typist. Subscribers are notified
 * when the typist set changes. Privacy gated — incoming messages are
 * dropped when the relevant setting is OFF.
 *
 * No persistence. Nothing ever touches IndexedDB or the sync manifest.
 */

import { logger } from '@quilibrium/quorum-shared';
import {
  type TypingMessage,
  type TypingScope,
  scopeKey,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  scopeFromMessage,
} from '@/types/typing';

const TYPING_THROTTLE_MS = 5_000;
const TYPING_TTL_MS = 8_000;

export interface TypingServiceOptions {
  /** Caller's own address, stamped onto outgoing TypingMessage.senderId */
  selfAddress: string;
  /** Sender callback for DM scope. Implements actual encryption + transport. */
  sendDM: (address: string, msg: TypingMessage) => Promise<void>;
  /** Sender callback for space scope (both space-channel and thread). */
  sendSpace: (spaceId: string, msg: TypingMessage) => Promise<void>;
  /** Privacy gate. Returns true if typing is enabled for this scope. */
  isEnabledForScope: (scope: TypingScope) => boolean;
}

type TypistEntry = {
  expiresAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
};

type Listener = (typists: string[]) => void;

export class TypingService {
  private options: TypingServiceOptions;

  // Send-side state: last typing-start emit time per scope (for throttle)
  private lastSentAt = new Map<string, number>();
  // Send-side: which scopes have an active outbound typing session (used for notifyStopped)
  private activeOutbound = new Set<string>();

  // Receive-side state: typists per scope
  private typists = new Map<string, Map<string, TypistEntry>>();
  // Receive-side state: subscribers per scope
  private listeners = new Map<string, Set<Listener>>();

  constructor(options: TypingServiceOptions) {
    this.options = options;
  }

  // ============================================================
  // SEND SIDE
  // ============================================================

  notifyTyping(scope: TypingScope): void {
    if (!this.options.isEnabledForScope(scope)) return;

    const key = scopeKey(scope);
    const now = Date.now();
    const last = this.lastSentAt.get(key) ?? 0;
    if (now - last < TYPING_THROTTLE_MS) return;

    this.lastSentAt.set(key, now);
    this.activeOutbound.add(key);
    this.emit(scope, 'typing-start');
  }

  notifyStopped(scope: TypingScope): void {
    const key = scopeKey(scope);
    if (!this.activeOutbound.has(key)) return;
    this.activeOutbound.delete(key);
    this.lastSentAt.delete(key);
    if (!this.options.isEnabledForScope(scope)) return;
    this.emit(scope, 'typing-stop');
  }

  private emit(scope: TypingScope, type: 'typing-start' | 'typing-stop'): void {
    const baseMsg = {
      type,
      senderId: this.options.selfAddress,
      timestamp: Date.now(),
    };

    if (scope.kind === 'dm') {
      const msg: TypingMessage = { ...baseMsg, scope: 'dm' };
      this.options.sendDM(scope.address, msg).catch((err) => {
        logger.warn('[Typing] sendDM failed', err);
      });
      return;
    }

    // space-channel or thread — guaranteed to have spaceId/channelId
    const msg: TypingMessage = {
      ...baseMsg,
      scope: 'space',
      spaceId: scope.spaceId,
      channelId: scope.channelId,
    };
    if (scope.kind === 'thread') {
      msg.threadId = scope.threadId;
    }
    this.options.sendSpace(scope.spaceId, msg).catch((err) => {
      logger.warn('[Typing] sendSpace failed', err);
    });
  }

  // ============================================================
  // RECEIVE SIDE (stubs — filled in Task 3)
  // ============================================================

  onTypingReceived(_msg: TypingMessage): void {
    // Implemented in Task 3
  }

  subscribe(_scope: TypingScope, _listener: Listener): () => void {
    // Implemented in Task 3
    return () => {};
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  destroy(): void {
    for (const entries of this.typists.values()) {
      for (const entry of entries.values()) {
        clearTimeout(entry.timeoutId);
      }
    }
    this.typists.clear();
    this.listeners.clear();
    this.lastSentAt.clear();
    this.activeOutbound.clear();
  }
}

// Suppress unused-import lint warning for TYPING_TTL_MS (used in Task 3)
void TYPING_TTL_MS;
