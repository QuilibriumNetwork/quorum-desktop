# Message Rate Limiting with User Experience Feedback

> **AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: security-analyst agent, feature-analyzer agent

**Status**: Pending
**Complexity**: Medium (simplified from High)
**Created**: 2025-12-11
**Updated**: 2025-12-11

**Files**:
- `src/utils/rateLimit.ts` - NEW: Simple rate limiting utility (~40 LOC)
- `src/hooks/business/messages/useMessageComposer.ts:148` - Add rate limit check
- `src/services/MessageService.ts` - Add receiving-side validation

## What & Why

**Current State**: No rate limiting exists on message submission. Malicious actors can flood channels with unlimited messages per second using DevTools, custom clients, or automation scripts.

**Desired State**: 2-layer rate limiting (UI + Receiving) that prevents abuse while maintaining good UX.

**Value**:
- **Security**: Prevents channel flooding and spam attacks
- **UX**: Protects users from accidental rapid-fire submissions
- **Network Health**: Reduces DHT bandwidth consumption

## MVP Implementation (Recommended)

### Overview

The MVP uses a **simple sliding window algorithm** instead of token bucket, and **2 layers** instead of 3:

| Layer | Location | Rate Limit | Purpose |
|-------|----------|------------|---------|
| **UI** | `useMessageComposer` | 5 msgs / 5 sec | Prevent accidental spam, show feedback |
| **Receiving** | `MessageService` | 10 msgs / 10 sec | Defense-in-depth against bypasses |

**Why this is sufficient**:
- Sliding window is simpler than token bucket (~40 LOC vs ~175 LOC)
- 2 layers follow the established pattern from recent security fixes (read-only, message length)
- Receiving layer catches all bypass attempts (DevTools, custom clients)
- 95% security coverage with 80% less code

---

## Phase 1: Rate Limiting Utility (Foundation)

### 1.1 Create Simple Rate Limiter

**File**: `src/utils/rateLimit.ts` (NEW)

```typescript
/**
 * Simple sliding window rate limiter for message submission
 *
 * Tracks timestamps of recent actions and rejects if limit exceeded.
 * Simpler than token bucket - no refill math, no capacity tracking.
 */
export class SimpleRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxMessages: number,
    private readonly windowMs: number
  ) {}

  /**
   * Check if action is allowed, track if yes
   * @returns {allowed: boolean, waitMs: number}
   */
  canSend(): { allowed: boolean; waitMs: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Remove expired timestamps (sliding window)
    this.timestamps = this.timestamps.filter(t => t > cutoff);

    if (this.timestamps.length < this.maxMessages) {
      this.timestamps.push(now);
      return { allowed: true, waitMs: 0 };
    }

    // Calculate wait time until oldest timestamp expires
    const oldestTimestamp = this.timestamps[0];
    const waitMs = (oldestTimestamp + this.windowMs) - now;

    return { allowed: false, waitMs: Math.max(0, waitMs) };
  }
}

/**
 * Rate limit presets
 */
export const RATE_LIMITS = {
  // UI layer: Gentle limit for accidental rapid clicking
  UI: { maxMessages: 5, windowMs: 5000 }, // 5 messages per 5 seconds

  // Receiving layer: More permissive, catches only true abuse
  RECEIVING: { maxMessages: 10, windowMs: 10000 }, // 10 messages per 10 seconds
} as const;
```

**Done when**: File created, TypeScript compiles

---

## Phase 2: UI Layer Rate Limiting

### 2.1 Add Rate Limit to useMessageComposer

**File**: `src/hooks/business/messages/useMessageComposer.ts`

**Changes**:
```typescript
// Add imports
import { useRef } from 'react';
import { SimpleRateLimiter, RATE_LIMITS } from '../../../utils/rateLimit';
import { showWarning } from '../../../utils/toast';
import { t } from '@lingui/core/macro';

// Inside useMessageComposer function, add:
const rateLimiter = useRef(
  new SimpleRateLimiter(RATE_LIMITS.UI.maxMessages, RATE_LIMITS.UI.windowMs)
);

// In submitMessage callback, add check after existing validations:
const submitMessage = useCallback(async () => {
  if ((pendingMessage || processedImage) && !isSubmitting) {
    // Existing validations
    if (pendingMessage && !validateMentions(pendingMessage)) return;
    if (pendingMessage && messageValidation.isOverLimit) return;

    // NEW: Rate limit validation
    const rateCheck = rateLimiter.current.canSend();
    if (!rateCheck.allowed) {
      showWarning(t`You're sending messages too quickly. Please wait a moment.`);
      return;
    }

    // ... rest of submission logic unchanged
  }
}, [/* existing deps */]);
```

**Done when**:
- Rapid clicking (6x) shows warning on 6th attempt
- Normal typing (2-3 messages) works without warning

---

## Phase 3: Receiving-Side Validation

### 3.1 Add Rate Detection in MessageService

**File**: `src/services/MessageService.ts`

**Add to class properties**:
```typescript
import { SimpleRateLimiter, RATE_LIMITS } from '../utils/rateLimit';

export class MessageService {
  // ... existing members ...

  // Per-sender rate limiters (receiving-side defense-in-depth)
  private receivingRateLimiters = new Map<string, SimpleRateLimiter>();
}
```

**Add in handleNewMessage** (after existing validation, before `queryClient.setQueryData`):
```typescript
// Receiving-side rate limit detection (Layer 2 - Defense-in-Depth)
const senderId = decryptedContent.content.senderId;

let limiter = this.receivingRateLimiters.get(senderId);
if (!limiter) {
  limiter = new SimpleRateLimiter(
    RATE_LIMITS.RECEIVING.maxMessages,
    RATE_LIMITS.RECEIVING.windowMs
  );
  this.receivingRateLimiters.set(senderId, limiter);
}

const rateCheck = limiter.canSend();
if (!rateCheck.allowed) {
  console.warn(
    `Rate limit: Message from ${senderId} rejected (flood detected). ` +
    `Message ID: ${decryptedContent.messageId}`
  );
  return; // Drop message silently (defense-in-depth)
}

// Authorized - proceed to add message to cache
```

**Done when**:
- DevTools flood test (11 messages in 5 sec) shows console warning
- Normal message flow works without warnings

---

## Verification (MVP)

- [ ] **UI layer**: Click send 6 times rapidly -> 6th shows warning
- [ ] **UI layer**: Send 3 messages normally (2 sec apart) -> No warning
- [ ] **Receiving layer**: DevTools spam 11 messages in 5 sec -> Logs show rejection
- [ ] **TypeScript**: `npx tsc --noEmit` passes
- [ ] **Regression**: Send DMs and channel messages normally

---

## Definition of Done (MVP)

- [ ] `src/utils/rateLimit.ts` created with SimpleRateLimiter class
- [ ] UI rate limiting in useMessageComposer with toast feedback
- [ ] Receiving-side rate detection in MessageService
- [ ] All verification tests pass
- [ ] TypeScript compiles without errors
- [ ] No regressions in existing message flow

---

## Optional Improvements (Future Iterations)

These enhancements can be added later based on real user feedback:

### Improvement 1: Token Bucket Algorithm

**When to add**: If users complain about being rate-limited during legitimate fast typing bursts

**What**: Replace sliding window with token bucket for smoother burst handling

```typescript
class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,  // Max burst size
    private readonly refillRate: number // Tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  tryConsume(): { success: boolean; nextAvailableMs: number } {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { success: true, nextAvailableMs: 0 };
    }

    const tokensNeeded = 1 - this.tokens;
    const msPerToken = 1000 / this.refillRate;
    return { success: false, nextAvailableMs: Math.ceil(tokensNeeded * msPerToken) };
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

**Benefit**: Allows more natural typing patterns with smooth token refill

---

### Improvement 2: Service Layer (3rd Layer)

**When to add**: If receiving-side validation alone isn't catching enough bypasses

**What**: Add rate limiting in `submitMessage` and `submitChannelMessage` methods

**Files**: `src/services/MessageService.ts:1017` (DM), `src/services/MessageService.ts:2756` (Channel)

```typescript
// In submitMessage/submitChannelMessage, before enqueueOutbound:
const rateLimitResult = this.serviceLimiter.tryConsume(currentPasskeyInfo.address);
if (!rateLimitResult.success) {
  showWarning(t`Message rate limit exceeded. Please wait before sending again.`);
  return;
}
```

**Benefit**: Defense-in-depth between UI and receiving validation

---

### Improvement 3: Precise Wait Time Feedback

**When to add**: If users request more specific feedback on when they can send again

**What**: Show countdown in toast notification

```typescript
const rateCheck = rateLimiter.current.canSend();
if (!rateCheck.allowed) {
  const waitSeconds = Math.ceil(rateCheck.waitMs / 1000);
  showWarning(
    waitSeconds > 5
      ? t`Please slow down. Wait about ${waitSeconds} seconds.`
      : t`You're sending messages too quickly. Please wait a moment.`
  );
  return;
}
```

**Benefit**: More helpful feedback for users who hit the limit

---

### Improvement 4: Per-User Cleanup Timer

**When to add**: If memory usage becomes a concern with many users

**What**: Automatic cleanup of inactive rate limiters

```typescript
class PerUserRateLimiter {
  private limiters = new Map<string, SimpleRateLimiter>();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    // Cleanup every 60 seconds
    this.cleanupTimer = setInterval(() => {
      if (this.limiters.size > 1000) {
        // Keep only recently active limiters
        // ... cleanup logic
      }
    }, 60000);
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.limiters.clear();
  }
}
```

**Benefit**: Prevents memory leaks in long-running sessions

---

### Improvement 5: Moderator Notifications

**When to add**: If space owners request abuse visibility

**What**: Notify moderators when rate limit violations are detected

```typescript
// In receiving-side validation:
if (!rateCheck.allowed) {
  console.warn(`Rate limit: Message from ${senderId} rejected`);

  // Notify space moderators (future enhancement)
  // this.notifyModerators(spaceId, senderId, 'rate_limit_violation');

  return;
}
```

**Benefit**: Enables community moderation of spam/abuse

---

### Improvement 6: Adaptive Rate Limits

**When to add**: If different user types need different limits

**What**: Higher limits for space owners/moderators, lower for new accounts

```typescript
const ADAPTIVE_LIMITS = {
  OWNER: { maxMessages: 15, windowMs: 5000 },
  MODERATOR: { maxMessages: 10, windowMs: 5000 },
  MEMBER: { maxMessages: 5, windowMs: 5000 },
  NEW_USER: { maxMessages: 3, windowMs: 5000 },
} as const;
```

**Benefit**: Trusted users aren't restricted, while new/suspicious accounts face stricter limits

---

## Security Context

### Threat Analysis

**Attack Vectors**:
1. DevTools bypass - rapid console calls
2. Custom malicious client - automated flooding
3. Script injection - browser extensions

**Impact**: MEDIUM severity
- Channel flooding affects all space members
- Client performance degradation
- Notification spam

### Why 2-Layer Defense Works

| Bypass Method | UI Layer | Receiving Layer |
|---------------|----------|-----------------|
| Rapid clicking | Blocked | - |
| DevTools calls | Bypassed | Blocked |
| Custom client | Bypassed | Blocked |

The receiving layer catches **all bypass attempts** because it validates incoming messages regardless of how they were sent.

---

## Implementation Notes

**Rate Limit Rationale**:
- **5 msgs / 5 sec (UI)**: Allows 2-3 quick messages, blocks spam
- **10 msgs / 10 sec (Receiving)**: More permissive to avoid false positives

**Design Decisions**:
- Sliding window chosen over token bucket for simplicity
- 2 layers instead of 3 (service layer adds minimal value)
- Single toast message instead of countdown (simpler UX)
- Per-user Map without cleanup timer (negligible memory impact)

**Trade-offs**:
- Simpler implementation = faster shipping
- Can add complexity later based on real user feedback
- MVP covers 95% of security value

---

*Created: 2025-12-11*
*Updated: 2025-12-11*
