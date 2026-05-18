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
  /** Logical timestamp from the last accepted message (for reorder protection). */
  msgTimestamp: number;
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
    const enabled = this.options.isEnabledForScope(scope);
    logger.log('[Typing] notifyTyping called', { scope, enabled });
    if (!enabled) return;

    const key = scopeKey(scope);
    const now = Date.now();
    const last = this.lastSentAt.get(key) ?? 0;
    if (now - last < TYPING_THROTTLE_MS) {
      logger.log('[Typing] notifyTyping throttled', { key, sinceLast: now - last });
      return;
    }

    this.lastSentAt.set(key, now);
    this.activeOutbound.add(key);
    logger.log('[Typing] emitting typing-start', { key });
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
  // RECEIVE SIDE
  // ============================================================

  /**
   * Process an incoming TypingMessage from the decrypt layer.
   * MessageService MUST gate this call by the user's typing setting AND
   * call back here so this method does the routing. We additionally
   * re-check the gate here as defense in depth.
   */
  onTypingReceived(msg: TypingMessage): void {
    logger.log('[Typing] onTypingReceived', { msg, selfAddress: this.options.selfAddress });
    // Defense in depth: drop self-originated messages
    if (msg.senderId === this.options.selfAddress) {
      logger.log('[Typing] dropped (self-originated)');
      return;
    }

    const scope = scopeFromMessage(msg);
    if (!scope) {
      logger.log('[Typing] dropped (could not resolve scope)');
      return;
    }

    if (!this.options.isEnabledForScope(scope)) {
      logger.log('[Typing] dropped (privacy gate OFF for scope)', { scope });
      return;
    }

    const key = scopeKey(scope);
    logger.log('[Typing] accepted', { key, listeners: this.listeners.get(key)?.size ?? 0 });
    let entries = this.typists.get(key);
    if (!entries) {
      entries = new Map();
      this.typists.set(key, entries);
    }

    const existing = entries.get(msg.senderId);

    // Reorder protection: ignore messages older than what we already have
    if (existing && msg.timestamp <= existing.msgTimestamp) return;

    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    if (msg.type === 'typing-stop') {
      if (!existing) return; // nothing to remove, nothing changed
      entries.delete(msg.senderId);
      if (entries.size === 0) this.typists.delete(key);
      this.notifyListeners(key);
      return;
    }

    const timeoutId = setTimeout(() => {
      const fresh = this.typists.get(key);
      if (fresh) {
        fresh.delete(msg.senderId);
        if (fresh.size === 0) this.typists.delete(key);
        this.notifyListeners(key);
      }
    }, TYPING_TTL_MS);

    entries.set(msg.senderId, { msgTimestamp: msg.timestamp, timeoutId });
    this.notifyListeners(key);
  }

  subscribe(scope: TypingScope, listener: Listener): () => void {
    const key = scopeKey(scope);
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);

    // Emit current state immediately if any typists exist
    const entries = this.typists.get(key);
    if (entries && entries.size > 0) {
      listener(Array.from(entries.keys()));
    }

    return () => {
      const s = this.listeners.get(key);
      if (!s) return;
      s.delete(listener);
      if (s.size === 0) this.listeners.delete(key);
    };
  }

  private notifyListeners(key: string): void {
    const listeners = this.listeners.get(key);
    if (!listeners || listeners.size === 0) return;
    const entries = this.typists.get(key);
    const typists = entries ? Array.from(entries.keys()) : [];
    for (const listener of listeners) {
      listener(typists);
    }
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

