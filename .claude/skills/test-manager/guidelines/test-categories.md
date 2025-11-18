# Test Categories and Organization

## Directory Structure

```
src/dev/tests/
├── services/       # Business logic and data services
├── utils/          # Pure functions and helpers
├── components/     # React UI components
├── hooks/          # Custom React hooks
├── integration/    # Multi-component workflows
├── e2e/           # Full user journeys
├── docs/          # Manual testing guides
├── setup.ts       # Global test configuration
└── README.md      # Main documentation
```

## Category Definitions

### 🏗️ Services (`services/`)

**Purpose**: Test business logic, data handling, and service classes

**What Lives Here**:
- MessageService, SpaceService, InvitationService tests
- Database service tests
- Authentication service tests
- API service tests
- State management services

**Testing Approach**:
- Unit tests with mocked dependencies
- Focus on method behavior and error handling
- Test service construction and dependency injection
- Mock external APIs and databases

**Example Files**:
```
MessageService.unit.test.tsx
SpaceService.unit.test.tsx
AuthService.unit.test.tsx
```

### 🔧 Utils (`utils/`)

**Purpose**: Test utility functions and helper modules

**What Lives Here**:
- Pure function tests
- Data transformation utilities
- Formatting helpers
- Validation functions
- Mathematical operations

**Testing Approach**:
- Test return values with various inputs
- Comprehensive edge case coverage
- Performance testing for critical utilities
- No mocking needed (pure functions)

**Example Files**:
```
messageGrouping.test.ts
mentionUtils.test.ts
dateUtils.test.ts
validationHelpers.test.ts
```

### 🎨 Components (`components/`)

**Purpose**: Test React component rendering and user interactions

**What Lives Here**:
- UI component tests
- Layout component tests
- Form component tests
- Modal and dialog tests

**Testing Approach**:
- Render testing with different props
- User interaction testing (clicks, typing, etc.)
- Accessibility testing
- Mock complex dependencies and services

**Example Files**:
```
MessageComposer.test.tsx
UserProfile.test.tsx
Modal.test.tsx
Button.test.tsx
```

### 🎣 Hooks (`hooks/`)

**Purpose**: Test custom React hooks in isolation

**What Lives Here**:
- Custom hook tests
- State management hook tests
- Effect hook tests
- API hook tests

**Testing Approach**:
- Use renderHook from React Testing Library
- Test initial state and state transitions
- Test effect dependencies and cleanup
- Mock external dependencies

**Example Files**:
```
useMessagesList.test.ts
useAuth.test.ts
useLocalStorage.test.ts
useAPI.test.ts
```

### 🔄 Integration (`integration/`)

**Purpose**: Test multiple components/services working together

**What Lives Here**:
- Feature workflow tests
- Service integration tests
- Component composition tests
- Data flow tests

**Testing Approach**:
- Test complete user workflows
- Use real components with minimal mocking
- Focus on component communication
- Test error propagation between layers

**Example Files**:
```
messageFlow.integration.test.tsx
userAuthentication.integration.test.tsx
spaceManagement.integration.test.tsx
```

### 🎭 E2E (`e2e/`)

**Purpose**: Test complete user journeys in real browser environment

**What Lives Here**:
- Critical user path tests
- Cross-browser compatibility tests
- Performance tests
- Accessibility compliance tests

**Testing Approach**:
- Use Playwright for browser automation
- Test with real backend services
- Focus on user-visible behavior
- Performance monitoring and screenshots

**Example Files**:
```
userLogin.e2e.test.ts
messageConversation.e2e.test.ts
spaceCreation.e2e.test.ts
```

## Test Type Decision Matrix

| Code Type | Service | Utils | Component | Hook | Integration | E2E |
|-----------|---------|--------|-----------|------|-------------|-----|
| Business Logic | ✅ Primary | ❌ | ❌ | ❌ | 🟡 Secondary | ❌ |
| Data Processing | ✅ Primary | ✅ Primary | ❌ | ❌ | 🟡 Secondary | ❌ |
| UI Components | ❌ | ❌ | ✅ Primary | ❌ | 🟡 Secondary | 🟡 Secondary |
| User Interactions | ❌ | ❌ | ✅ Primary | ❌ | ✅ Primary | ✅ Primary |
| State Management | 🟡 Secondary | ❌ | 🟡 Secondary | ✅ Primary | 🟡 Secondary | ❌ |
| API Integration | ✅ Primary | ❌ | ❌ | 🟡 Secondary | ✅ Primary | 🟡 Secondary |
| Complete Workflows | ❌ | ❌ | ❌ | ❌ | ✅ Primary | ✅ Primary |

## Naming Conventions

### Service Tests
- `ServiceName.unit.test.tsx` (standard)
- `ServiceName.integration.test.tsx` (if testing service integration)

### Utility Tests
- `utilityName.test.ts` (simple utilities)
- `utilityName.unit.test.ts` (complex utilities with mocks)

### Component Tests
- `ComponentName.test.tsx` (standard)
- `ComponentName.integration.test.tsx` (if testing with providers)

### Hook Tests
- `useHookName.test.ts` (standard)

### Integration Tests
- `featureName.integration.test.tsx` (feature workflows)
- `serviceName.integration.test.ts` (service integration)

### E2E Tests
- `userFlow.e2e.test.ts` (user journeys)
- `critical.e2e.test.ts` (critical paths)

## File Organization Rules

### Grouping by Feature
```
components/
├── message/
│   ├── MessageComposer.test.tsx
│   ├── MessageList.test.tsx
│   └── MessageItem.test.tsx
└── user/
    ├── UserProfile.test.tsx
    └── UserSettings.test.tsx
```

### Test File Co-location
- Keep tests close to the code they test
- Mirror the source directory structure
- Use descriptive test file names

### Shared Test Utilities
```
__fixtures__/
├── mockData.ts
├── testHelpers.ts
└── TestProviders.tsx
```

## Dependencies and Mocking Guidelines

### Service Tests
- Mock MessageDB, APIs, WebSockets
- Mock React Query client
- Mock crypto operations

### Component Tests
- Mock complex hooks
- Mock service dependencies
- Mock routing and navigation

### Integration Tests
- Minimal mocking
- Use TestProviders for context
- Mock external APIs only

### E2E Tests
- No mocking (real environment)
- Use staging/test backend
- Real browser interactions

## Test Isolation

### Between Categories
- Each category should be independently runnable
- No shared state between test categories
- Category-specific setup and teardown

### Within Categories
- Each test file should be independent
- Use proper cleanup in beforeEach/afterEach
- Avoid test order dependencies

### Global Setup
- Shared configuration in `setup.ts`
- Global mocks for WebSocket, crypto
- React Testing Library configuration

## Running Tests by Category

```bash
# All tests
yarn vitest src/dev/tests/ --run

# Individual categories
yarn vitest src/dev/tests/services/ --run
yarn vitest src/dev/tests/utils/ --run
yarn vitest src/dev/tests/components/ --run
yarn vitest src/dev/tests/hooks/ --run
yarn vitest src/dev/tests/integration/ --run

# E2E tests (separate command)
yarn playwright test src/dev/tests/e2e/
```

## Migration Guide

### Adding New Categories
1. Create directory under `src/dev/tests/`
2. Add README.md with category guidelines
3. Update main README.md structure
4. Add category to test scripts
5. Create example test file

### Moving Tests Between Categories
1. Move test file to appropriate directory
2. Update import paths if needed
3. Adjust test approach for new category
4. Update documentation references