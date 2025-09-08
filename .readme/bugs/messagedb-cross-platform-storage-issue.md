# MessageDB Context: IndexedDB Platform Compatibility Issue  

[← Back to INDEX](/../INDEX.md)


**Status:** Medium Priority - Requires platform-specific implementation  
**Affects:** React Native/Expo Go builds  
**Culprit Commit:** `a51ea3f663e43957a6b1f477eabe5ae1100c3616`  

## Issue Description

Mobile app crashes on startup with error:
```
TypeError: window.addEventListener is not a function (it is undefined)
```

## Root Cause Analysis

**Actual Problem**: Commit a51ea3f6 added `useMessageDB` import to `useOnboardingFlowLogic.ts`. The MessageDB context uses IndexedDB APIs that don't exist in React Native.

**Import Chain**:
1. `useOnboardingFlowLogic.ts` imports `useMessageDB` context (✅ legitimate need)
2. `MessageDB.tsx` imports `src/db/messages.ts` 
3. `messages.ts` calls `indexedDB.open()` (❌ web-only API)

**Evidence from Commit**:
```typescript
// Added in useOnboardingFlowLogic.ts:
import { useMessageDB } from '../../../components/context/MessageDB';

// MessageDB context uses:
const { getConfig } = useMessageDB(); // This loads IndexedDB code
```

## Technical Details

**MessageDB Context Complexity**:
- **Size**: 5,346 lines combining storage + business logic
- **Storage**: Uses IndexedDB (`src/db/messages.ts`) for browser-based local database
- **Functions**: Message encryption/decryption, user configs, space management, real-time sync
- **Problem**: IndexedDB doesn't exist in React Native - needs AsyncStorage equivalent

**Required Platform Support**:
- **Web**: IndexedDB for local message storage
- **Mobile**: AsyncStorage equivalent for React Native  
- **Business Logic**: Config management, message handling (90% shared)

## Implementation Plan

**Phase 1: Extract Storage Layer**
- Create storage adapter interface for database operations
- Implement `platform/storage/useIndexedDBAdapter.web.ts` - wraps existing IndexedDB calls
- Implement `platform/storage/useAsyncStorageAdapter.native.ts` - AsyncStorage equivalent
- Abstract all `indexedDB.open()` calls behind common interface

**Phase 2: Update MessageDB Context**
- Inject storage adapter into MessageDB context constructor  
- Replace direct IndexedDB calls with adapter methods
- Ensure all crypto operations remain platform-agnostic
- Test all storage operations (messages, configs, encrypted data) work identically

**Phase 3: Platform Resolution**
- Create `MessageDB.native.tsx` that uses AsyncStorage adapter
- Keep existing `MessageDB.tsx` using IndexedDB adapter for web
- Update Metro bundler configuration for proper platform resolution
- Verify mobile app launches and onboarding flow works

**Complexity Assessment**: Medium-High but manageable
- ✅ Single point of failure: only `messages.ts` calls IndexedDB directly  
- ✅ Well-defined MessageDB interface makes abstraction cleaner
- ✅ Adapter pattern already proven successful in codebase
- ⚠️ Large codebase with complex crypto operations requires careful testing

## Impact

- **Current**: Completely blocks all mobile development/testing
- **Solution**: Enables full cross-platform MessageDB functionality  
- **Risk**: Medium - crypto/storage complexity but isolated to storage layer


---

*Created: 2025-08-16*  
*Updated: 2025-08-21 - Corrected analysis after commit review*

[← Back to INDEX](/../INDEX.md)