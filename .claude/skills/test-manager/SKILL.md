---
name: "Test Manager"
description: "Automatically creates, organizes, and maintains tests following project standards. Activates when implementing features, fixing bugs, or refactoring code to ensure proper test coverage and documentation."
version: "1.1.0"
dependencies:
  - "vitest"
  - "@testing-library/react"
  - "@testing-library/react-hooks"
---

# Test Manager Skill

This skill automatically handles test creation, organization, and maintenance for the Quorum Desktop project.

## Source of Truth

**For current test inventory, counts, and detailed descriptions, always read:**
- `src/dev/tests/README.md` — main index with all test files, counts, and detailed descriptions
- `src/dev/tests/[category]/README.md` — category-specific inventory and guidelines

These files are kept up-to-date and are the single source of truth. This skill defines the *process* — the READMEs define the *inventory*.

## When to Activate

**Automatically activate when:**
- Implementing new features or components
- Fixing bugs or refactoring existing code
- Creating new utility functions or services
- Modifying existing functionality that affects behavior
- Adding new hooks or React components

## Testing Philosophy

**What we test:**
- Service construction and method signatures
- Business logic and early return conditions
- Error handling and validation
- Component rendering and user interactions
- Utility function behavior and edge cases
- Hook return values and state updates
- Database store CRUD operations

**What we DON'T test:**
- Implementation details
- Third-party library functionality
- Real database/API operations (use mocks)
- Browser-specific behavior

## Test Organization

All tests live in `src/dev/tests/` organized by category:

| Directory | Purpose |
|-----------|---------|
| `services/` | Service unit tests with mocked dependencies |
| `utils/` | Utility function tests (pure functions) |
| `components/` | React component rendering and accessibility |
| `db/` | Database store operations (IndexedDB) |
| `hooks/` | Custom React hooks |
| `integration/` | Multi-component workflows |
| `e2e/` | Full user journeys |
| `docs/` | Manual testing guides |

## Naming Conventions

- **Service tests**: `ServiceName.unit.test.tsx`
- **Utility tests**: `utilityName.test.ts` or `utilityName.unit.test.ts`
- **Component tests**: `ComponentName.test.tsx`
- **Database tests**: `storeName.test.ts`
- **Hook tests**: `useHookName.test.ts`
- **Integration tests**: `featureName.integration.test.tsx`
- **E2E tests**: `userFlow.e2e.test.ts`

## Decision Matrix: When to Create Tests

### New Service/Class → ALWAYS create unit tests
- Test construction with dependencies
- Test all public methods
- Test error handling
- Mock all external dependencies

### New Component → ALWAYS create component tests
- Test rendering with different props
- Test user interactions (clicks, typing)
- Test accessibility
- Mock complex dependencies

### New Utility Function → ALWAYS create utility tests
- Test return values with various inputs
- Test edge cases (null, empty, undefined)
- Test error conditions
- Performance tests for critical functions

### New Database Store/Schema → ALWAYS create db tests
- Test save and retrieve operations
- Test filtering and querying
- Test deletion
- Place in `src/dev/tests/db/`

### Bug Fix → CREATE tests if none exist
- Test the bug condition
- Test the fix
- Add regression tests

### Refactor → UPDATE existing tests
- Ensure tests still pass
- Update mocks if interfaces changed
- Add tests for new functionality

## Running Tests

```bash
# All tests
yarn vitest src/dev/tests/ --run

# By category
yarn vitest src/dev/tests/services/ --run
yarn vitest src/dev/tests/utils/ --run
yarn vitest src/dev/tests/components/ --run
yarn vitest src/dev/tests/db/ --run
yarn vitest src/dev/tests/hooks/ --run
yarn vitest src/dev/tests/integration/ --run

# Watch mode
yarn vitest src/dev/tests/ --watch
```

## Documentation Updates

**After adding or removing test files, update:**
- `src/dev/tests/README.md` — add/remove from directory tree, update counts, add detailed section
- `src/dev/tests/[category]/README.md` — update category inventory table

## Templates and Examples

See the `examples/` directory for test templates:
- Service test template
- Component test template
- Utility test template
- Hook test template

## Quality Guidelines

- **Test names**: Should clearly describe what is being tested
- **Mocking**: Mock external dependencies, not the code under test
- **Assertions**: Be specific about expected behavior
- **Setup**: Use beforeEach for common test setup
- **Cleanup**: Tests should not affect each other
- **One file per unit**: Keep test files focused (one service/component per file)
