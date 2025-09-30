# MessageDB.tsx Refactoring Analysis

**Status**: AUTOMATED IMPLEMENTATION PLAN
**Priority**: High
**Complexity**: Very High
**Automation**: Claude Code with minimal user intervention
**Created**: 2025-09-25
**Updated**: 2025-09-30

https://github.com/QuilibriumNetwork/quorum-desktop/issues/78

## Problem Statement

The `src/components/context/MessageDB.tsx` file has grown to 5,650 lines and violates multiple architectural principles:

- **Single Responsibility Violation**: Handles 25+ different concerns in one file
- **Tight Coupling**: Mixes encryption, messaging, sync, and UI logic
- **Poor Maintainability**: Massive functions (1000+ lines each)
- **Low Testability**: Monolithic structure makes unit testing difficult
- **Performance Issues**: Large context causes unnecessary re-renders

## 🛡️ Testing Safety Net - CRITICAL FOR SUCCESS

**⚠️ MANDATORY**: All refactoring work MUST be done with continuous testing validation to prevent breaking changes.

**📋 Comprehensive Test Documentation**: See [`src/dev/refactoring/test-implementation-guide.md`](../src/dev/refactoring/test-implementation-guide.md) for complete testing strategy, test status, and incremental workflow procedures.

**🎯 Current Test Status**:
- ✅ **61 tests passing** across 5 test files (3.05s execution)
- ✅ **7 critical functions** protected with mock integration tests
- ✅ **Immediate failure detection** for breaking changes during refactoring
- ✅ **Phase 1 Complete** - Ready for service extraction

## 📊 EXTRACTION PROGRESS TRACKER

### 🎯 BOUNDARY COMMENT STRATEGY

**Important**: Large function replacements (200-300+ lines) are causing file corruption due to incorrect boundary detection.
Add boundary comments before attempting large function replacements:

```typescript
// START_FUNCTION_NAME_FUNCTION
const functionName = React.useCallback(async (...) => {
  // Large function body (200+ lines)
}, []);
// END_FUNCTION_NAME_FUNCTION
```

**Benefits**:
- ✅ Safe replacement of massive functions without corruption
- ✅ Clear identification of function boundaries
- ✅ Prevents accidental truncation or malformed edits
- ✅ Enables clean delegation while preserving exact APIs

**Usage**: Apply boundary comments → verify placement → replace entire block with delegation

> Note: the line numbers in the below lists are relative to the original file: src\components\context\MessageDB.bak.tsx

#### MessageService
- [x] **saveMessage** - Extracted 2025-09-30 (198 lines, 5 branches)
- [x] **addMessage** - Extracted 2025-09-30 (276 lines, 5 branches)
- [x] **submitMessage** - Extracted 2025-09-30 (204 lines, P2P encryption workflow)
- [x] **handleNewMessage**function to extract
- [x] **submitChannelMessage** - MessageDB.tsx:1567
- [x] **deleteConversation** - MessageDB.tsx:2234

#### EncryptionService (to be created)
- [ ] **deleteEncryptionStates** - MessageDB.tsx:3456
- [ ] **ensureKeyForSpace** - MessageDB.tsx:2789

#### SpaceService (to be created)
- [ ] **createSpace** - MessageDB.tsx:3234
- [ ] **updateSpace** - MessageDB.tsx:3567
- [ ] **createChannel** - MessageDB.tsx:4123
- [ ] **deleteSpace** - MessageDB.tsx:4456
- [ ] **kickUser** - MessageDB.tsx:4789

**🚨 Testing Requirements During Refactoring**:
1. **NEVER skip testing** after each service extraction
2. **STOP immediately** if any test fails during refactoring
3. **Run full test suite** before and after each change
4. **Rollback immediately** if tests fail - debug before continuing
5. **100% test pass rate** must be maintained throughout

The test suite provides a comprehensive safety net that will immediately detect any breaking changes during the complex service extraction process. **Failure to follow the testing workflow will result in broken functionality.**

## Detailed Analysis Findings

### Current Structure Issues
- Message submission, encryption/decryption, space management, synchronization, and configuration all mixed together
- Functions like `handleNewMessage` span 1000+ lines with complex nested logic
- Direct IndexedDB operations mixed with business logic
- No clear separation between read and write operations

### Architecture Violations
- Violates data management architecture guidelines from `.readme/docs/data-management-architecture-guide.md`
- Context provider does too much beyond data access
- Business logic tightly coupled to React context
- No proper error boundaries or resilience patterns

## Automated Implementation Strategy (Test-First Approach)

Following the notes recommendation, this refactoring will be performed by Claude Code using a test-first, in-place migration approach with minimal user intervention:

### Phase 1: Comprehensive Testing
Claude Code will automatically:

1. **Create Behavior Tests**
   - Analyze MessageDB.tsx to identify all functions and their behaviors
   - Generate comprehensive unit tests for all current functions
   - Create integration tests for critical message flows
   - Setup IndexedDB mocks for consistent testing
   - Generate test cases for encryption/decryption cycles
   - Create tests for space management operations
   - Generate synchronization behavior tests

2. **Document Current Behaviors**
   - Automatically map all function inputs, outputs, and side effects
   - Document state mutation patterns through code analysis
   - Catalog error handling scenarios by analyzing try/catch blocks
   - Record performance benchmarks by running existing code

3. **Test Infrastructure Setup**
   - Create test utilities for MessageDB operations
   - Generate mock data generators based on existing data structures
   - Configure Jest for async operations
   - Create test helpers for encryption scenarios

### Phase 2: Incremental Service Extraction

**Strategy**: "Move First, Optimize Later" with continuous testing validation.

#### Incremental Extraction Order:
1. **MessageService** - Message CRUD, reactions, submissions (600+ lines, highest complexity)
2. **EncryptionService** - Key management, encrypt/decrypt operations
3. **SpaceService** - Space management, membership, permissions
4. **InvitationService** - Invite generation, processing, joining
5. **SyncService** - Synchronization, conflict resolution
6. **UserService** - User profiles, user management
7. **ConfigService** - User configuration management

#### Per-Service Extraction Workflow:

**🔄 For Each Service Extraction:**

```bash
# 1. BEFORE extraction - verify baseline
yarn vitest src/dev/refactoring/tests/ --run
# ✅ 61 tests pass = baseline established

# 2. Extract service (e.g., MessageService)
# Move submitMessage, handleNewMessage to MessageService.ts
# ZERO modifications - exact copy of logic

# 3. IMMEDIATELY test after extraction
yarn vitest src/dev/refactoring/tests/ --run
# ✅ 61 tests pass = extraction successful
# ❌ ANY tests fail = STOP, rollback, debug

# 4. Wire service into MessageDB context
# Update context to use new MessageService
# Maintain exact same API surface

# 5. IMMEDIATELY test after integration
yarn vitest src/dev/refactoring/tests/ --run
# ✅ 61 tests pass = integration successful
# ❌ ANY tests fail = STOP, rollback, debug

# 6. Commit successful extraction
git add . && git commit -m "Extract MessageService - tests pass"

# 7. Repeat for next service
```

#### Safety Checkpoints:

**Before Each Extraction:**
```bash
# Verify starting state is clean
yarn vitest src/dev/refactoring/tests/ --run  # All tests pass
yarn build                                    # No build errors
yarn lint                                     # No lint errors
git status                                    # Clean working directory
```

**After Each Extraction:**
```bash
# Verify extraction didn't break anything
yarn vitest src/dev/refactoring/tests/ --run  # All tests still pass ← CRITICAL
yarn build                                    # Still builds successfully
yarn lint                                     # No new lint errors

# Performance verification
# Bundle size hasn't increased
# Memory usage hasn't increased
# Load time hasn't degraded
```

#### Emergency Rollback Procedure:
```bash
# If ANY test fails during extraction:
git reset --hard HEAD~1  # Rollback to last working state
yarn vitest src/dev/refactoring/tests/ --run  # Verify tests pass
# Analyze failure before retrying extraction
```

#### Service Extraction Principles:
- **Zero optimization** during extraction - move code exactly as-is
- **Maintain exact logic flow** and error handling
- **Keep identical function signatures**
- **Preserve all state management patterns**
- **STOP immediately** if any test fails
- **Commit after each successful extraction**

## 🚨 CRITICAL EXTRACTION REQUIREMENTS

### **MANDATORY COMPLETE EXTRACTION RULE**

**❌ IT IS NOT OK TO DO PARTIAL EXTRACTIONS**

During the previous refactoring attempt, we discovered that partial function extractions create serious issues:
- **Broken logic**: Missing parts of functions lead to incorrect behavior
- **Hard-to-debug issues**: Incomplete implementations cause subtle bugs
- **Code duplication**: Partial extractions leave duplicate logic in both places
- **Maintenance nightmare**: Changes must be made in multiple locations

### **EXTRACTION COMPLETENESS REQUIREMENTS**

When extracting ANY function from MessageDB.tsx:

1. **EXTRACT EVERYTHING** - Every single line of the function implementation MUST be extracted
2. **NO STUBS OR PLACEHOLDERS** - Never leave `// TODO:` or `throw new Error("Not implemented")`
3. **NO PARTIAL LOGIC** - If a function has 500 lines, extract all 500 lines exactly
4. **EXACT COPY ONLY** - Use `// EXACT COPY:` comments to track what was moved from where
5. **COMPLETE DEPENDENCIES** - Include all helper functions, imports, and dependencies
6. **ALL BRANCHES** - Extract every if/else, try/catch, switch case completely
7. **ALL ERROR HANDLING** - Preserve every error handling scenario exactly as-is

### **VERIFICATION CHECKLIST FOR EACH EXTRACTION**

Before marking any function as "extracted", verify:
- [ ] **Line count matches**: Original function lines = extracted function lines (excluding whitespace)
- [ ] **All branches covered**: Every if/else, try/catch, switch case is preserved
- [ ] **All dependencies included**: No missing imports, helper functions, or utilities
- [ ] **Error handling complete**: All error scenarios handled identically
- [ ] **State mutations preserved**: All state changes happen exactly the same way
- [ ] **Side effects maintained**: All API calls, database operations, cache updates preserved
- [ ] **Comments preserved**: All important comments explaining complex logic included

### **EXTRACTION FAILURE INDICATORS**

**STOP IMMEDIATELY** if you find yourself:
- Writing `// TODO: Complete this section later`
- Using `throw new Error("Not implemented yet")`
- Thinking "I'll implement this complex part later"
- Removing error handling to "simplify" extraction
- Skipping complex nested logic
- Leaving function stubs or placeholders

**Remember**: It's better to extract one function completely than to partially extract multiple functions.

## 📋 STEP-BY-STEP WORKFLOW (MUST FOLLOW THIS ORDER)

### **Step 1: AUDIT Phase - Review All Code Before Extraction**

Before extracting anything, perform complete audit:

1. **Identify Target Function**: Choose one function to extract (e.g., `saveMessage`)
2. **Map Dependencies**: List all imports, helper functions, types this function needs
3. **Count Lines**: Note exact line count of function (including all branches)
4. **Document Complexity**: Note any particularly complex sections
5. **Check Test Coverage**: Verify this function is covered by existing tests

**✅ Audit Complete Criteria**: Can answer "What exactly needs to be moved?" with complete precision

### **Step 2: CREATE Service File**

1. **Create empty service file** (e.g., `src/services/MessageService.ts`)
2. **Add minimal structure**: Class definition, constructor, dependencies
3. **Add imports**: All necessary imports identified in audit
4. **NO implementation yet** - just file structure
5. **Verify it compiles**: Run TypeScript check to ensure no import errors

**✅ Service Created Criteria**: Empty service file compiles without errors

### **Step 3: EXTRACT Function (Complete Copy)**

1. **Copy entire function** from MessageDB.tsx to service
2. **Preserve EXACT logic** - every line, every branch, every comment
3. **Add dependency injection** only where needed (change `messageDB` to `this.messageDB`)
4. **Add `// EXACT COPY:` comment** with original line numbers
5. **NO other changes** - resist any urge to "improve" or optimize

**✅ Extraction Complete Criteria**: Function does exactly the same thing in service as original

### **Step 4: WIRE Service Into MessageDB Context**

1. **Create service instance** in MessageDB provider
2. **Replace function implementation** with delegation call to service
3. **Maintain identical API** - same parameters, same return type
4. **NO behavioral changes** - exact same function signature

**✅ Integration Complete Criteria**: MessageDB.tsx now delegates to service, API unchanged

### **Step 5: TEST AND VERIFY**

1. **Run all tests**: `yarn test` - ALL tests must pass
2. **Check TypeScript**: `yarn tsc --noEmit` - no compilation errors
3. **Test manually**: Basic functionality works as expected
4. **If ANY issues**: Rollback immediately, debug, try again

**✅ Verification Complete Criteria**: All tests pass, TypeScript compiles, functionality preserved

### **ONLY AFTER STEP 5 SUCCEEDS**: Move to next function

**NEVER work on multiple functions simultaneously - complete one full cycle before starting the next.**

### Phase 3: Service Integration & Testing
Claude Code will automatically:

1. **Service Integration**
   - Wire services into decomposed contexts
   - Ensure all tests pass without modification
   - Validate performance matches baseline
   - Test cross-platform compatibility

2. **Regression Testing**
   - Run full test suite to verify behavior preservation
   - Performance testing to ensure no degradation
   - Cross-platform testing (web/mobile)
   - End-to-end testing of critical flows

### Phase 4: Optimization & Cleanup
Only after all tests pass and behavior is verified, Claude Code will:

1. **Code Optimization**
   - Reduce duplicate code across services
   - Optimize data structures and algorithms
   - Improve error handling patterns
   - Add proper TypeScript types

2. **Performance Optimization**
   - Optimize React Query usage
   - Reduce unnecessary re-renders
   - Improve IndexedDB operation efficiency
   - Add proper memoization where needed

## Detailed Service Architecture

### MessageService
**Responsibilities:**
- Message CRUD operations
- Message encryption/decryption
- Reaction management
- Message submission workflows
- File attachment handling

**Key Methods:**
```typescript
createMessage(content: string, spaceId: string): Promise<Message>
encryptMessage(message: Message): Promise<EncryptedMessage>
decryptMessage(encryptedMessage: EncryptedMessage): Promise<Message>
addReaction(messageId: string, emoji: string): Promise<void>
submitMessage(message: Message): Promise<void>
```

### SpaceService
**Responsibilities:**
- Space creation and management
- Member management
- Permission handling
- Space configuration
- Space synchronization

**Key Methods:**
```typescript
createSpace(name: string, config: SpaceConfig): Promise<Space>
addMember(spaceId: string, userId: string): Promise<void>
updatePermissions(spaceId: string, permissions: Permissions): Promise<void>
syncSpace(spaceId: string): Promise<void>
```

### EncryptionService
**Responsibilities:**
- Key generation and management
- Encryption state tracking
- Cross-platform encryption compatibility
- Key rotation workflows

**Key Methods:**
```typescript
generateKeyPair(): Promise<KeyPair>
encryptData(data: any, publicKey: string): Promise<EncryptedData>
decryptData(encryptedData: EncryptedData, privateKey: string): Promise<any>
rotateKeys(spaceId: string): Promise<void>
```

### SyncService
**Responsibilities:**
- Message synchronization
- Space synchronization
- Conflict resolution
- Offline/online state management

**Key Methods:**
```typescript
syncMessages(spaceId: string, lastSync: Date): Promise<Message[]>
handleConflicts(conflicts: Conflict[]): Promise<void>
queueOfflineOperations(operations: Operation[]): Promise<void>
```

### ConfigService
**Responsibilities:**
- Application configuration
- User preferences
- Cross-platform settings
- Migration handling

**Key Methods:**
```typescript
getConfig(key: string): Promise<any>
setConfig(key: string, value: any): Promise<void>
migrateConfig(fromVersion: string, toVersion: string): Promise<void>
```

## Testing Strategy

### Unit Testing Approach
1. **Test Each Service Independently**
   - Mock all external dependencies
   - Test all public methods
   - Test error scenarios
   - Test edge cases

2. **Test Coverage Requirements**
   - 90%+ line coverage on all services
   - 100% coverage on critical encryption paths
   - 100% coverage on data persistence operations

3. **Test Categories**
   - **Happy Path Tests**: Normal operation scenarios
   - **Error Path Tests**: Network failures, encryption errors, data corruption
   - **Edge Case Tests**: Empty data, malformed inputs, race conditions
   - **Integration Tests**: Service interactions
   - **Cross-Platform Tests**: Web/mobile compatibility

### Test Infrastructure
```
src/tests/
├── services/
│   ├── MessageService.test.ts
│   ├── SpaceService.test.ts
│   ├── EncryptionService.test.ts
│   ├── SyncService.test.ts
│   └── ConfigService.test.ts
├── integration/
│   ├── messageFlow.test.ts
│   ├── spaceManagement.test.ts
│   └── syncOperations.test.ts
├── mocks/
│   ├── indexedDB.mock.ts
│   ├── webSocket.mock.ts
│   └── encryption.mock.ts
└── utils/
    ├── testHelpers.ts
    ├── dataGenerators.ts
    └── setupTests.ts
```

## Risk Mitigation

### Technical Risks
1. **Breaking Changes**
   - Mitigation: Comprehensive test coverage before changes
   - Rollback plan: Git branches for each phase
   - Monitoring: Automated testing in CI/CD

2. **Performance Degradation**
   - Mitigation: Performance benchmarks before changes
   - Monitoring: Performance tests in CI/CD
   - Rollback: Keep old implementation until new is proven

3. **Cross-Platform Compatibility**
   - Mitigation: Test on both web and mobile platforms
   - Monitoring: Platform-specific test suites
   - Validation: Manual testing on target devices

### Migration Risks
1. **Data Loss**
   - Mitigation: Backup strategies for IndexedDB
   - Testing: Data migration tests
   - Recovery: Data recovery procedures

2. **User Experience Disruption**
   - Mitigation: Gradual rollout with feature flags
   - Monitoring: User experience metrics
   - Rollback: Immediate rollback procedures

### Emergency Procedures During Refactoring

**If Tests Fail During Extraction:**
1. **STOP immediately** - Do not continue extraction
2. **Rollback** to last known good state (`git reset --hard HEAD~1`)
3. **Analyze failure** - What behavior changed?
4. **Fix extraction** - Ensure identical behavior preserved
5. **Re-test** - Verify all tests pass before continuing

**If Production Issues Detected:**
1. **Feature flag** - Disable new services immediately
2. **Rollback** - Switch back to original MessageDB
3. **Hotfix** - Deploy rollback to production
4. **Root cause** - Analyze what tests missed
5. **Improve tests** - Add missing test coverage

**Rollback Commands:**
```bash
# Emergency rollback during development
git reset --hard HEAD~1  # Rollback to last working state
yarn vitest src/dev/refactoring/tests/ --run  # Verify tests pass
# Analyze failure before retrying

# If multiple commits need rollback
git log --oneline  # Find last good commit
git reset --hard <commit-hash>  # Reset to last good state
```

## Automated Execution Plan

Claude Code will execute this refactoring automatically in sequential phases, updating checkboxes as tasks complete:

### Phase 1: Comprehensive Test Setup & Behavior Documentation
- [x] Setup comprehensive test infrastructure (use Vitest - integrates with Vite)
  - [x] Add `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/jest-dom` to devDependencies
  - [x] Add test scripts to package.json: `"test": "vitest"`, `"test:ui": "vitest --ui"`
  - [x] Create `vitest.config.ts` with proper React testing setup
  - [x] ~~Update vite.config.ts to exclude test files from production build~~ (Not needed - `/dev/` exclusion already covers this)
- [x] Create comprehensive test infrastructure in `src/dev/refactoring/tests/`
  - [x] Create `src/dev/refactoring/tests/setup.ts` with test configuration
  - [x] Create `src/dev/refactoring/tests/mocks/indexedDB.mock.ts`
  - [x] Create `src/dev/refactoring/tests/mocks/webSocket.mock.ts`
  - [x] Create `src/dev/refactoring/tests/mocks/encryption.mock.ts`
  - [x] Create `src/dev/refactoring/tests/utils/testHelpers.tsx` (renamed to .tsx for JSX support)
  - [x] Create `src/dev/refactoring/tests/utils/dataGenerators.ts`
- [x] Analyze MessageDB.tsx structure and document all behavior
  - [x] Document all exported functions and their signatures
  - [x] Map all state mutations and side effects
  - [x] Identify all async operations and dependencies
  - [x] Catalog all error handling scenarios
  - [x] Create `src/dev/refactoring/messagedb-behavior-map.md`
- [x] Create comprehensive test infrastructure for MessageDB functionality
  - [x] Created complete mock utilities for IndexedDB, WebSocket, and encryption
  - [x] Created test helpers for React component testing with React Query
  - [x] Created comprehensive data generators for all entity types
  - [x] All TypeScript compilation errors resolved
  - [x] ~~**USER ACTION NEEDED**: Run `yarn install` to install test dependencies~~ (COMPLETED)
  - [x] ~~**USER ACTION NEEDED**: Run `yarn test` to verify test infrastructure works~~ (COMPLETED)
- [x] **PHASE 1 COMPLETE**: Option A Mock Integration Tests Implementation
  - [x] **Test Status**: 61 tests passing in 5 files (3.05s duration)
  - [x] **Safety Net Established**: 7 critical functions protected with mock integration tests
  - [x] **Comprehensive Documentation**: All documentation consolidated in `src/dev/refactoring/TEST_IMPLEMENTATION_COMPLETE.md`
  - [x] **Ready for Phase 2**: Service extraction workflow documented and validated

### Phase 2: Service Extraction
- [ ] Create service directory structure
  - [ ] Create `src/services/` directory
  - [ ] Create `src/services/types/` directory for shared types
  - [ ] Create `src/services/utils/` directory for shared utilities
- [ ] Extract MessageService with zero optimization
  - [ ] Create `src/services/MessageService.ts`
  - [ ] Move message CRUD operations (exact copy)
  - [ ] Move message encryption/decryption operations (exact copy)
  - [ ] Move reaction management operations (exact copy)
  - [ ] Move file attachment handling (exact copy)
  - [ ] Create `src/dev/refactoring/tests/services/MessageService.test.ts`
  - [ ] Claude Code runs `yarn test` automatically to verify MessageService works identically to original
- [ ] Extract EncryptionService with zero optimization
  - [ ] Create `src/services/EncryptionService.ts`
  - [ ] Move key generation and management (exact copy)
  - [ ] Move encryption state tracking (exact copy)
  - [ ] Move key rotation workflows (exact copy)
  - [ ] Create `src/dev/refactoring/tests/services/EncryptionService.test.ts`
  - [ ] Claude Code runs `yarn test` automatically to verify EncryptionService works identically to original
- [ ] Extract SpaceService with zero optimization
  - [ ] Create `src/services/SpaceService.ts`
  - [ ] Move space creation and management (exact copy)
  - [ ] Move member management operations (exact copy)
  - [ ] Move permission handling (exact copy)
  - [ ] Move space configuration (exact copy)
  - [ ] Create `src/dev/refactoring/tests/services/SpaceService.test.ts`
  - [ ] Claude Code runs `yarn test` automatically to verify SpaceService works identically to original
- [ ] Extract SyncService with zero optimization
  - [ ] Create `src/services/SyncService.ts`
  - [ ] Move message synchronization (exact copy)
  - [ ] Move space synchronization (exact copy)
  - [ ] Move conflict resolution (exact copy)
  - [ ] Move offline/online state management (exact copy)
  - [ ] Create `src/dev/refactoring/tests/services/SyncService.test.ts`
  - [ ] Claude Code runs `yarn test` automatically to verify SyncService works identically to original
- [ ] Extract ConfigService with zero optimization
  - [ ] Create `src/services/ConfigService.ts`
  - [ ] Move application configuration (exact copy)
  - [ ] Move user preferences (exact copy)
  - [ ] Move migration handling (exact copy)
  - [ ] Create `src/dev/refactoring/tests/services/ConfigService.test.ts`
  - [ ] Claude Code runs `yarn test` automatically to verify ConfigService works identically to original
- [ ] Validation after each extraction
  - [ ] Claude Code runs complete test suite (`yarn test`) after each service extraction
  - [ ] Verify all tests pass before proceeding to next service
  - [ ] Run `yarn build` to ensure no build errors
  - [ ] Verify no TypeScript compilation errors

### Phase 3: Integration & Validation
- [ ] Create decomposed context structure
  - [ ] Create `src/contexts/` directory
  - [ ] Create `src/contexts/MessageContext.tsx`
  - [ ] Create `src/contexts/SpaceContext.tsx`
  - [ ] Create `src/contexts/EncryptionContext.tsx`
  - [ ] Create `src/contexts/SyncContext.tsx`
  - [ ] Create `src/contexts/ConfigContext.tsx`
- [ ] Wire all services into decomposed contexts
  - [ ] Update MessageContext to use MessageService
  - [ ] Update SpaceContext to use SpaceService
  - [ ] Update EncryptionContext to use EncryptionService
  - [ ] Update SyncContext to use SyncService
  - [ ] Update ConfigContext to use ConfigService
  - [ ] Maintain exact same API surface for all contexts
- [ ] Update MessageDB.tsx to orchestrate contexts
  - [ ] Remove extracted code from MessageDB.tsx
  - [ ] Wire decomposed contexts together
  - [ ] Maintain exact same export interface
  - [ ] Preserve all existing React Query integrations
- [ ] Comprehensive validation with full test suite
  - [ ] Claude Code runs complete test suite (`yarn test`) to verify all functionality preserved
  - [ ] Create integration tests for context interactions in `src/dev/refactoring/tests/integration/`
  - [ ] Test cross-service communication works correctly
  - [ ] Verify all original MessageDB functionality still works through comprehensive tests
- [ ] Performance validation and cross-platform testing
  - [ ] Run `yarn build` and compare bundle size to baseline
  - [ ] Run performance benchmark tests
  - [ ] Test on web platform in development
  - [ ] Verify memory usage patterns haven't changed significantly
- [ ] Final validation before optimization
  - [ ] Confirm all tests pass (`yarn test`)
  - [ ] Confirm TypeScript compilation succeeds
  - [ ] Verify lint checks pass (`yarn lint`)
  - [ ] Test in both development and production builds
  - [ ] Document any deviation from original behavior (should be none)

### Phase 4: Optimization
- [ ] Optimize MessageService and EncryptionService
  - [ ] Remove duplicate code within MessageService
  - [ ] Optimize data structures in MessageService
  - [ ] Improve error handling in MessageService
  - [ ] Remove duplicate code within EncryptionService
  - [ ] Optimize encryption algorithms if possible
  - [ ] Improve TypeScript types for both services
  - [ ] Run tests after each optimization to ensure no regressions
- [ ] Optimize SpaceService, SyncService, ConfigService
  - [ ] Remove duplicate code within SpaceService
  - [ ] Optimize space management algorithms
  - [ ] Remove duplicate code within SyncService
  - [ ] Optimize synchronization logic
  - [ ] Remove duplicate code within ConfigService
  - [ ] Improve configuration handling
  - [ ] Improve TypeScript types for all services
  - [ ] Run tests after each optimization to ensure no regressions
- [ ] Optimize context integration
  - [ ] Optimize React Query usage across contexts
  - [ ] Add proper memoization where needed
  - [ ] Reduce unnecessary re-renders
  - [ ] Improve context provider performance
  - [ ] Add error boundaries where appropriate
- [ ] Final performance optimization
  - [ ] Optimize IndexedDB operation efficiency
  - [ ] Review and optimize async operation patterns
  - [ ] Add performance monitoring where beneficial
  - [ ] Final performance benchmark comparison
- [ ] Code cleanup and TypeScript improvements
  - [ ] Add comprehensive JSDoc comments
  - [ ] Improve TypeScript type definitions
  - [ ] Remove any remaining dead code
  - [ ] Ensure consistent code style across all files
  - [ ] Add proper exports/imports structure
- [ ] Final testing and production readiness verification
  - [ ] Run complete test suite (`yarn test`) with all optimizations
  - [ ] Verify performance meets or exceeds baseline (bundle size, memory)
  - [ ] Confirm cross-platform compatibility maintained
  - [ ] Validate TypeScript compilation (`yarn build`)
  - [ ] Run linting and formatting checks (`yarn lint`, `yarn format`)
  - [ ] Create final documentation for changes in `src/dev/refactoring/`
  - [ ] Prepare rollback plan documentation
  - [ ] Remove test infrastructure from production build (tests stay in `src/dev/`)

## Success Criteria (Updated)

### Quantitative Metrics
- Reduce main MessageDB.tsx file from 5650 to <500 lines
- Achieve >90% test coverage on extracted services
- Pass 100% of comprehensive test suite throughout refactoring
- Maintain or improve performance (baseline +/-5%)
- Zero breaking changes to existing API
- No increase in production bundle size
- Successful TypeScript compilation at all phases

### Qualitative Metrics
- Clear separation of concerns across services
- Improved code maintainability scores
- Reduced cognitive complexity
- Better error handling and resilience
- Improved developer experience

## Dependencies & Constraints

### Technical Dependencies
- Must maintain cross-platform compatibility (web/mobile)
- Cannot break existing React Query patterns
- Must preserve encryption security model
- Requires coordination with WebSocket provider changes
- Must work with existing IndexedDB schema

### Resource Constraints
- Testing environment resources
- Code review for final validation
- User approval for production deployment

### Business Constraints
- Cannot disrupt existing user workflows
- Must maintain data integrity
- Cannot break existing integrations
- Must support rollback scenarios

## CLAUDE CODE IMPLEMENTATION NOTES

**Automated Execution Principles:**
1. **Test First**: Claude Code will pin down all behaviors with comprehensive tests before making any changes
2. **Move First, Optimize Later**: Extract code in-place with no optimizations, then optimize once everything works
3. **Incremental Validation**: Test at each step to ensure behaviors remain identical
4. **Cross-Platform Focus**: Ensure all changes work on both web and mobile platforms
5. **Zero Breaking Changes**: Maintain exact same API surface throughout the refactoring

**User Intervention Points:**
- **Initial Approval**: User confirms to start the refactoring process
- **Phase Completion Reviews**: User validates each major phase completion
- **Final Approval**: User approves final optimized implementation
- **Emergency Stops**: User can halt process if issues are detected

**Automated Quality Assurance:**
- All tests must pass before proceeding to next phase
- Performance benchmarks must be maintained or improved
- Cross-platform compatibility validated automatically
- TypeScript compilation must succeed at all phases
- Lint checks must pass throughout the process
- Checkboxes updated automatically as Claude Code completes each task

**Rollback Strategy:**
- Git branches created for each phase
- Automatic rollback if any phase fails validation
- User can request rollback at any intervention point
- Full restore capability to original state

---



## ✅ CLAUDE CODE UNDERSTANDING CONFIRMATION

**I understand the following requirements:**

1. **Complete Extraction Only**: Never do partial extractions - extract entire functions with all logic
2. **Gradual Approach**: Follow 5-step workflow strictly - audit → create → extract → wire → test
3. **Test-First Safety**: All tests must pass after each change, rollback immediately if any fail
4. **No Optimization**: Move code exactly as-is, no improvements during extraction phase
5. **One Function at a Time**: Complete full cycle for one function before starting next
6. **Dependency Mapping**: Identify all imports, helpers, types needed before extraction
7. **API Preservation**: Maintain identical function signatures and behavior
8. **Error Prevention**: Stop immediately if writing TODOs, stubs, or partial implementations

**I will NOT:**
- Rush through multiple functions simultaneously
- Leave placeholder implementations or TODOs
- Skip complex parts of functions
- Optimize or improve code during extraction
- Continue if any tests fail

**I will follow the 5-step workflow religiously and ask for guidance if anything is unclear.**

---

_Last updated: 2025-09-30_