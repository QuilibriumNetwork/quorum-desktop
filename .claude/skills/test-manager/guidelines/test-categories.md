# Test Categories and Organization

## Source of Truth

**For current file lists and test counts per category, read:**
- `src/dev/tests/README.md` — complete inventory
- `src/dev/tests/[category]/README.md` — per-category details

This file defines the *rules* for each category. The READMEs track the *inventory*.

## Category Definitions

### Services (`services/`)

**Purpose**: Test business logic, data handling, and service classes

**What goes here**: Service class unit tests — anything with dependency injection, business logic, or API interaction.

**Testing approach**:
- Unit tests with mocked dependencies
- Focus on method behavior and error handling
- Test service construction and dependency injection
- Mock external APIs, databases, and crypto operations

### Utils (`utils/`)

**Purpose**: Test utility functions and helper modules

**What goes here**: Pure function tests — data transformation, formatting, validation, processing utilities.

**Testing approach**:
- Test return values with various inputs
- Comprehensive edge case coverage
- Performance testing for critical utilities
- No mocking needed (pure functions)

### Components (`components/`)

**Purpose**: Test React component rendering and user interactions

**What goes here**: UI component tests — rendering, props, interactions, accessibility.

**Testing approach**:
- Render testing with different props
- User interaction testing (clicks, typing, etc.)
- Accessibility testing
- Mock complex dependencies and services

### Database (`db/`)

**Purpose**: Test IndexedDB store operations and data persistence

**What goes here**: Store CRUD operation tests, query/filtering tests, schema validation tests.

**Testing approach**:
- Test save, retrieve, and delete operations
- Test filtering by index/key
- Mock IndexedDB with fake-indexeddb
- Verify data integrity

### Hooks (`hooks/`)

**Purpose**: Test custom React hooks in isolation

**Testing approach**:
- Use renderHook from React Testing Library
- Test initial state and state transitions
- Test effect dependencies and cleanup
- Mock external dependencies

### Integration (`integration/`)

**Purpose**: Test multiple components/services working together

**Testing approach**:
- Test complete user workflows
- Use real components with minimal mocking
- Focus on component communication
- Test error propagation between layers

### E2E (`e2e/`)

**Purpose**: Test complete user journeys in real browser environment

**Testing approach**:
- Use Playwright for browser automation
- Test with real backend services
- Focus on user-visible behavior
- Performance monitoring and screenshots

## Test Type Decision Matrix

| Code Type | Service | Utils | Component | DB | Hook | Integration | E2E |
|-----------|---------|--------|-----------|-----|------|-------------|-----|
| Business Logic | Primary | - | - | - | - | Secondary | - |
| Data Processing | Primary | Primary | - | - | - | Secondary | - |
| Data Persistence | Secondary | - | - | Primary | - | Secondary | - |
| UI Components | - | - | Primary | - | - | Secondary | Secondary |
| User Interactions | - | - | Primary | - | - | Primary | Primary |
| State Management | Secondary | - | Secondary | - | Primary | Secondary | - |
| API Integration | Primary | - | - | - | Secondary | Primary | Secondary |
| Complete Workflows | - | - | - | - | - | Primary | Primary |

## Naming Conventions

| Category | Pattern |
|----------|---------|
| Service | `ServiceName.unit.test.tsx` |
| Utility | `utilityName.test.ts` or `utilityName.unit.test.ts` |
| Component | `ComponentName.test.tsx` |
| Database | `storeName.test.ts` |
| Hook | `useHookName.test.ts` |
| Integration | `featureName.integration.test.tsx` |
| E2E | `userFlow.e2e.test.ts` |

## Dependencies and Mocking Guidelines

| Category | What to mock |
|----------|-------------|
| Service | MessageDB, APIs, WebSockets, crypto, React Query client |
| Component | Complex hooks, service dependencies, routing/navigation |
| DB | IndexedDB (use fake-indexeddb) |
| Integration | External APIs only — use real components |
| E2E | Nothing — real environment |

## Test Isolation

- Each category should be independently runnable
- Each test file should be independent
- Use proper cleanup in beforeEach/afterEach
- Avoid test order dependencies
- Global mocks (WebSocket, crypto) live in `setup.ts`

## Running Tests

```bash
yarn vitest src/dev/tests/ --run                # All
yarn vitest src/dev/tests/services/ --run       # Services
yarn vitest src/dev/tests/utils/ --run          # Utils
yarn vitest src/dev/tests/components/ --run     # Components
yarn vitest src/dev/tests/db/ --run             # Database
yarn vitest src/dev/tests/hooks/ --run          # Hooks
yarn vitest src/dev/tests/integration/ --run    # Integration
yarn playwright test src/dev/tests/e2e/         # E2E
```

## Adding New Categories

1. Create directory under `src/dev/tests/`
2. Add `README.md` with category guidelines
3. Update `src/dev/tests/README.md` directory tree
4. Add category to test run commands
