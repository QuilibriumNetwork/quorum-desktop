# Integration Tests

Tests that verify multiple components/services working together.

## Naming Convention
- `featureName.integration.test.tsx` - Feature integration tests
- `serviceName.integration.test.ts` - Service integration tests

## Test Structure
```typescript
import { render, screen } from '@testing-library/react';
import { TestProviders } from '../__fixtures__/TestProviders';
import { FeatureComponent } from '@/components/FeatureComponent';

describe('Feature Integration', () => {
  it('should handle complete user flow', async () => {
    render(
      <TestProviders>
        <FeatureComponent />
      </TestProviders>
    );

    // Test complete workflow
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });
});
```

## What to Test
- ✅ Complete user workflows
- ✅ Service interactions
- ✅ Data flow between components
- ✅ Error handling across boundaries
- ✅ State management integration
- ✅ Real API calls (with test environment)

## Test Environment
- Use real services when possible
- Test database with clean state
- Mock external APIs
- Isolated test environment

_Created: 2025-11-18_