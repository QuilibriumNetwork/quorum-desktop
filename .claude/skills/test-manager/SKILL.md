---
name: "Test Manager"
description: "Automatically creates, organizes, and maintains tests following project standards. Activates when implementing features, fixing bugs, or refactoring code to ensure proper test coverage and documentation."
version: "1.0.0"
dependencies:
  - "vitest"
  - "@testing-library/react"
  - "@testing-library/react-hooks"
---

# Test Manager Skill

This skill automatically handles test creation, organization, and maintenance for the Quorum Desktop project.

## When to Activate

**Automatically activate when:**
- Implementing new features or components
- Fixing bugs or refactoring existing code
- Creating new utility functions or services
- Modifying existing functionality that affects behavior
- Adding new hooks or React components

**Key trigger phrases:**
- "Add/implement/create [feature/component/service/utility]"
- "Fix [bug/issue] in [component/service]"
- "Refactor [code/component/service]"
- "Update [functionality/behavior]"

## Testing Philosophy

**What we test:**
- ✅ Service construction and method signatures
- ✅ Business logic and early return conditions
- ✅ Error handling and validation
- ✅ Component rendering and user interactions
- ✅ Utility function behavior and edge cases
- ✅ Hook return values and state updates

**What we DON'T test:**
- ❌ Implementation details
- ❌ Third-party library functionality
- ❌ Real database/API operations (use mocks)
- ❌ Browser-specific behavior

## Test Organization Structure

```
src/dev/tests/
├── services/                    # Service unit tests
├── utils/                       # Utility function tests
├── components/                  # React component tests
├── hooks/                       # React hooks tests
├── integration/                 # Integration tests
├── e2e/                         # End-to-end tests
├── docs/                        # Manual testing guides
├── setup.ts                     # Global test setup
└── README.md                    # Main documentation
```

## Naming Conventions

- **Service tests**: `ServiceName.unit.test.tsx`
- **Utility tests**: `utilityName.test.ts` or `utilityName.unit.test.ts`
- **Component tests**: `ComponentName.test.tsx`
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

### Bug Fix → CREATE tests if none exist
- Test the bug condition
- Test the fix
- Add regression tests

### Refactor → UPDATE existing tests
- Ensure tests still pass
- Update mocks if interfaces changed
- Add tests for new functionality

## Running Tests

### All Tests
```bash
yarn vitest src/dev/tests/ --run
```

### By Category
```bash
yarn vitest src/dev/tests/services/ --run      # Service tests
yarn vitest src/dev/tests/utils/ --run         # Utility tests
yarn vitest src/dev/tests/components/ --run    # Component tests
yarn vitest src/dev/tests/hooks/ --run         # Hook tests
yarn vitest src/dev/tests/integration/ --run   # Integration tests
```

### Development (Watch Mode)
```bash
yarn vitest src/dev/tests/ --watch
```

## Documentation Updates

**When to update README files:**
- After adding new test categories or files
- When changing test organization
- After adding new testing patterns or tools
- When test coverage changes significantly

**Files to update:**
- `src/dev/tests/README.md` - Main documentation
- `src/dev/tests/[category]/README.md` - Category-specific docs

## Integration with Development Workflow

1. **Before implementing**: Consider what tests will be needed
2. **During implementation**: Create tests alongside code
3. **After implementation**: Run tests to verify functionality
4. **Before committing**: Ensure all tests pass
5. **Documentation**: Update README files if test structure changed

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

## Performance Considerations

- Keep test files focused (one service/component per file)
- Use appropriate timeouts for async operations
- Mock expensive operations
- Consider parallelization for large test suites

---

_This skill ensures consistent testing practices across the Quorum Desktop project._