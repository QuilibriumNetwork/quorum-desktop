# When to Create Tests - Decision Guide

## Automatic Testing Scenarios

### ✅ ALWAYS Create Tests For:

#### New Features
- **Services/Classes**: Any new service or business logic class
- **Components**: React components with user interactions
- **Utilities**: Pure functions and helper modules
- **Hooks**: Custom React hooks
- **API Endpoints**: New backend functionality

#### Bug Fixes
- **Regression Tests**: Prevent the bug from reoccurring
- **Edge Case Tests**: Cover the conditions that caused the bug
- **Integration Tests**: If the bug involved multiple components

#### Refactoring
- **Behavior Tests**: Ensure functionality remains the same
- **Interface Tests**: Verify public APIs haven't changed
- **Performance Tests**: Ensure refactoring didn't degrade performance

### 🤔 CONSIDER Testing For:

#### Minor Updates
- **Configuration Changes**: If they affect behavior
- **Style Updates**: If they include functional changes
- **Documentation**: Usually no tests needed unless examples

#### Third-Party Integration
- **Wrapper Functions**: Test your wrapper, not the library
- **Adapter Patterns**: Test the adaptation logic
- **Configuration**: Test that setup works correctly

### ❌ DON'T Test:

#### Implementation Details
- **Private Methods**: Test through public interface
- **Internal State**: Test observable behavior instead
- **Framework Code**: Don't test React, Vitest, etc.
- **Third-Party Libraries**: Trust they work correctly

#### Trivial Code
- **Simple Getters/Setters**: Unless they have validation
- **Pass-Through Functions**: That just call other functions
- **Constants**: Static values without logic

## Decision Tree

```
New Code Written?
├─ YES: Is it user-facing functionality?
│  ├─ YES: Create component/integration tests
│  └─ NO: Is it business logic?
│     ├─ YES: Create service/utility tests
│     └─ NO: Is it a reusable utility?
│        ├─ YES: Create utility tests
│        └─ NO: Consider if testing adds value
└─ NO: Bug fix or refactor?
   ├─ Bug Fix: Create regression tests
   └─ Refactor: Ensure existing tests pass
```

## Test Priority Levels

### 🔴 Critical (Must Test)
- User authentication and security
- Payment processing
- Data persistence and retrieval
- Critical user workflows
- Public APIs

### 🟡 Important (Should Test)
- UI components with complex logic
- Utility functions used in multiple places
- Error handling and validation
- Performance-sensitive code

### 🟢 Nice to Have (Could Test)
- Simple display components
- One-off utility functions
- Configuration helpers
- Development tools

## When to Skip Tests

### Time Constraints (Technical Debt)
- Create a task to add tests later
- Document what needs testing
- Prioritize critical functionality first

### Prototype/Spike Work
- Tests can slow down exploration
- Add tests when promoting to production
- Focus on learning and validation

### Legacy Code Changes
- Small changes may not warrant full test coverage
- Add tests incrementally
- Focus on areas being actively developed

## Quality Gates

### Before Merging PR:
- [ ] All new functionality has appropriate tests
- [ ] Tests cover error conditions
- [ ] Tests pass consistently
- [ ] Test coverage hasn't decreased significantly

### Before Release:
- [ ] Critical paths are fully tested
- [ ] Integration tests pass
- [ ] Performance tests meet requirements
- [ ] Manual testing completed for complex features

## Common Anti-Patterns to Avoid

❌ **Testing Implementation Details**
```javascript
// BAD: Testing internal state
expect(component.state.internalCounter).toBe(5);

// GOOD: Testing observable behavior
expect(screen.getByText('Count: 5')).toBeInTheDocument();
```

❌ **Over-Mocking**
```javascript
// BAD: Mocking everything
vi.mock('@/utils/helper');
vi.mock('@/constants');

// GOOD: Only mock what you need to
vi.mock('@/services/api');
```

❌ **Testing Frameworks**
```javascript
// BAD: Testing that React works
expect(useState).toBeDefined();

// GOOD: Testing your code works
expect(result.current.count).toBe(0);
```

## Test ROI Calculation

High ROI tests:
- Prevent expensive bugs
- Test complex business logic
- Cover integration points
- Test error handling

Low ROI tests:
- Test simple getters/setters
- Duplicate coverage
- Test obvious functionality
- Over-test stable code