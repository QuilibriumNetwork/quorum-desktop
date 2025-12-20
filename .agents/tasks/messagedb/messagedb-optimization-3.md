# High-Risk Optimization Opportunities

**Status**: 📋 Future Reference
**Created**: 2025-10-03
**Updated**: 2025-12-20
**Context**: High-risk large function refactorings in SpaceService and InvitationService

> **Note**: These optimizations target large functions in **SpaceService** (`kickUser`, `createSpace`) and **InvitationService** (`joinInviteLink`). They are independent improvements that can be tackled when there's a clear need.

> **Dec 2025 Update**: The `handleNewMessage` refactoring is no longer planned (archived). These optimizations are **no longer blocked**, but remain low priority unless there's a specific need (e.g., adding features to kick flow, fixing bugs in space creation).

---

## Overview

This document tracks **high-risk optimization opportunities** that involve breaking down large orchestration functions (300+ lines). These are **low priority** and should only be tackled when:
- There's a clear need (adding features, fixing bugs in these areas)
- The specific function is causing maintenance pain
- You have time for comprehensive testing

**Note**: The `handleNewMessage` refactoring has been archived as not recommended. See [messagedb-current-state.md](./messagedb-current-state.md) for current direction.

---

## High-Risk Tasks

### 🔴 Task 1: Break Down `kickUser` (443 lines)

**Risk**: ⚠️⚠️ HIGH
**Time**: 3-4 hours
**Priority**: Medium
**Location**: `SpaceService.ts` lines 638-1080

#### Current Structure

```
kickUser (443 lines total)
├─ Validate permissions (20 lines)
├─ Verify signatures (50 lines)
├─ Send kick messages (100 lines)
├─ Clean up space data (150 lines)
├─ Handle self-kick navigation (50 lines)
└─ Update query cache (73 lines)
```

#### Why High Risk

- Complex cryptographic operations (signature verification, encryption)
- Multiple database operations (space members, messages, encryption states)
- Navigation side effects (self-kick redirects)
- Query cache invalidation (React Query updates)
- Error handling spans multiple async operations

#### Recommended Approach

**Similar to handleNewMessage refactoring** - extract focused sub-methods:

1. **Extract `validateKickPermissions()`**
   - Check if kicker is owner/admin
   - Verify target user exists in space
   - Return validation result

2. **Extract `verifyKickSignatures()`**
   - Verify owner signature on kick message
   - Verify message authenticity
   - Return verification result

3. **Extract `sendKickMessages()`**
   - Send kick notification via hub
   - Send rekey messages to remaining members
   - Return sent message IDs

4. **Extract `cleanupKickedUserData()`**
   - Remove from space members table
   - Delete user's encryption state
   - Clean up message references
   - Return cleanup status

5. **Extract `handleSelfKickNavigation()`**
   - Detect if kicking self
   - Navigate to spaces list
   - Clear local state
   - Return navigation result

6. **Extract `updateKickQueryCache()`**
   - Invalidate space members cache
   - Update message cache
   - Refresh space info
   - Return updated cache

7. **Main `kickUser()` becomes orchestration** (~80-100 lines)
   ```typescript
   async kickUser(params) {
     // Orchestrate the 6 sub-operations
     const isValid = await this.validateKickPermissions(params);
     if (!isValid) return { success: false, reason: 'permission_denied' };

     const isVerified = await this.verifyKickSignatures(params);
     if (!isVerified) return { success: false, reason: 'invalid_signature' };

     await this.sendKickMessages(params);
     await this.cleanupKickedUserData(params);
     await this.handleSelfKickNavigation(params);
     await this.updateKickQueryCache(params);

     return { success: true };
   }
   ```

#### Success Criteria

- Main `kickUser()` reduced to 80-100 lines
- 6 focused sub-methods (50-100 lines each)
- All existing tests pass (SpaceService has 13 tests)
- Zero regressions in kick functionality
- Clear error handling at each step

#### When to Do This

- When adding new kick-related features
- When fixing bugs in the kick flow
- When the function becomes a maintenance burden

---

### 🔴 Task 2: Break Down `createSpace` (352 lines)

**Risk**: ⚠️⚠️ HIGH
**Time**: 3-4 hours
**Priority**: Medium
**Location**: `SpaceService.ts` lines 118-469

#### Current Structure

```
createSpace (352 lines total)
├─ Generate encryption keys (80 lines)
├─ Create space registration (100 lines)
├─ Set up initial channels (70 lines)
├─ Save to database (50 lines)
└─ Update query cache (52 lines)
```

#### Why High Risk

- Complex key generation (space, config, hub, inbox, owner keys)
- Cryptographic signing operations
- API registration with backend
- Multiple database writes (space, keys, channels, encryption states)
- Query cache updates
- Error recovery is complex (partial state)

#### Recommended Approach

Extract 5 focused sub-methods:

1. **Extract `generateSpaceKeys()`**
   - Generate all required key pairs (space, config, hub, inbox)
   - Calculate addresses from public keys
   - Return key bundle

2. **Extract `createSpaceRegistration()`**
   - Create space registration payload
   - Sign with owner and space keys
   - Post to API
   - Return registration response

3. **Extract `setupInitialChannels()`**
   - Create default channels (general, announcements)
   - Set up channel encryption states
   - Return channel list

4. **Extract `persistSpaceData()`**
   - Save space to database
   - Save all keys to database
   - Save encryption states
   - Return save status

5. **Extract `updateSpaceQueryCache()`**
   - Update spaces list cache
   - Update config cache
   - Return updated cache

6. **Main `createSpace()` becomes orchestration** (~60-80 lines)
   ```typescript
   async createSpace(params) {
     const keys = await this.generateSpaceKeys(params);
     const registration = await this.createSpaceRegistration(keys, params);
     const channels = await this.setupInitialChannels(keys, params);
     await this.persistSpaceData(keys, channels, params);
     await this.updateSpaceQueryCache(params);

     return { spaceId: keys.spaceAddress, channels };
   }
   ```

#### Success Criteria

- Main `createSpace()` reduced to 60-80 lines
- 5 focused sub-methods (50-80 lines each)
- All existing tests pass
- Zero regressions in space creation
- Proper error handling and rollback

#### When to Do This

- When adding new space creation features
- When fixing bugs in the creation flow
- When the function becomes a maintenance burden

---

### 🔴 Task 3: Break Down `joinInviteLink` (343 lines)

**Risk**: ⚠️⚠️ HIGH
**Time**: 3-4 hours
**Priority**: Medium
**Location**: `InvitationService.ts` lines 546-888

#### Current Structure

```
joinInviteLink (343 lines total)
├─ Decrypt invite template (50 lines)
├─ Verify invite signature (30 lines)
├─ Generate member keys (60 lines)
├─ Register with hub (80 lines)
├─ Set up encryption (60 lines)
├─ Save member data (40 lines)
└─ Update query cache (23 lines)
```

#### Why High Risk

- Invite link decryption and verification
- Complex key generation for new member
- Hub registration (multiple API calls)
- Encryption state initialization
- Database operations (keys, space, members, states)
- Query cache updates
- Error handling across multiple async operations

#### Recommended Approach

Extract 7 focused sub-methods:

1. **Extract `decryptInviteTemplate()`**
   - Decrypt invite link payload
   - Parse template data
   - Return decrypted template

2. **Extract `verifyInviteSignature()`**
   - Verify owner signature
   - Verify invite hasn't been used
   - Return verification result

3. **Extract `generateMemberKeys()`**
   - Generate inbox key pair
   - Calculate inbox address
   - Return member keys

4. **Extract `registerMemberWithHub()`**
   - Post inbox to hub
   - Register member with space
   - Return registration response

5. **Extract `setupMemberEncryption()`**
   - Initialize encryption state
   - Set up ratchet for member
   - Return encryption state

6. **Extract `persistMemberData()`**
   - Save keys to database
   - Save space member record
   - Save encryption states
   - Return save status

7. **Extract `updateJoinQueryCache()`**
   - Update spaces list
   - Update space members
   - Return updated cache

8. **Main `joinInviteLink()` becomes orchestration** (~60-80 lines)
   ```typescript
   async joinInviteLink(inviteLink: string) {
     const template = await this.decryptInviteTemplate(inviteLink);
     const isValid = await this.verifyInviteSignature(template);
     if (!isValid) throw new Error('Invalid invite');

     const keys = await this.generateMemberKeys(template);
     await this.registerMemberWithHub(keys, template);
     await this.setupMemberEncryption(keys, template);
     await this.persistMemberData(keys, template);
     await this.updateJoinQueryCache(template);

     return { spaceId: template.spaceId };
   }
   ```

#### Success Criteria

- Main `joinInviteLink()` reduced to 60-80 lines
- 7 focused sub-methods (40-60 lines each)
- All existing tests pass (InvitationService has 15 tests)
- Zero regressions in invite flow
- Clear error messages at each step

#### When to Do This

- When adding new invite-related features
- When fixing bugs in the join flow
- When the function becomes a maintenance burden

---

### 🔴 Task 4: Separate Crypto Operations (VERY HIGH RISK)

**Risk**: ⚠️⚠️⚠️ VERY HIGH
**Time**: 1-2 weeks
**Priority**: Low (maybe never)

#### What It Would Involve

Create a dedicated `CryptoService` to handle:
- Signature generation/verification
- Key pair generation
- Encryption/decryption operations
- Ratchet state management
- Address calculation

#### Why VERY HIGH Risk

- Crypto operations are tightly coupled to encryption context
- Would require leaking encryption state across services
- Risk of introducing security vulnerabilities
- Complex distributed transactions
- High chance of breaking existing functionality
- Extensive refactoring across all services

#### Recommendation

**DO NOT DO THIS** unless there's a compelling reason:
- Current crypto code is co-located with encryption context (correct)
- Separation would break encapsulation
- Risk far outweighs any benefits
- Better to extract small crypto utilities (as done in the 'Quick Wins' step)

---

## Implementation Priority

These are **opportunistic refactorings** — do them when you're already working in that area:

| Task | When to Consider |
|------|------------------|
| `createSpace` | Adding space features, fixing creation bugs |
| `kickUser` | Adding moderation features, fixing kick bugs |
| `joinInviteLink` | Changing invite flow, fixing join bugs |
| CryptoService | **Never** — risk far outweighs benefit |

---

## General Guidelines for High-Risk Refactoring

### Before Starting

1. ✅ Have a clear reason (feature, bug fix, maintenance pain)
2. ✅ Test coverage is adequate for the function
3. ✅ Have a clear rollback plan (git commit before each step)

### During Refactoring

1. **Extract one method at a time**
2. **Run tests after each extraction**
3. **Commit after each successful extraction**
4. **Stop immediately if tests fail**
5. **Keep main function as simple orchestration**

### Testing Requirements

```bash
# After each method extraction
yarn vitest src/dev/refactoring/tests/ --run

# Must pass all tests (75+ total):
# - ConfigService: 2 tests
# - EncryptionService: 2 tests
# - InvitationService: 15 tests
# - MessageService: 27 tests
# - SpaceService: 13 tests
# - SyncService: 16 tests
```

### Rollback Procedure

If tests fail:
```bash
git reset --hard HEAD~1  # Rollback last commit
yarn vitest src/dev/refactoring/tests/ --run  # Verify tests pass
# Analyze failure, fix issue, try again
```

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| kickUser lines | 443 | 80-100 |
| createSpace lines | 352 | 60-80 |
| joinInviteLink lines | 343 | 60-80 |
| Test pass rate | 75/75 | 75/75 |
| Code readability | Low | High |
| Maintainability | Low | High |

---

_Last updated: 2025-12-20_
_Status: 📋 Future Reference - Opportunistic refactorings_
_Targets: SpaceService (kickUser, createSpace), InvitationService (joinInviteLink)_
