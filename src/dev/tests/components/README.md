# Component Tests

React component unit and integration tests.

## Naming Convention
- `ComponentName.test.tsx` - Standard component tests
- `ComponentName.integration.test.tsx` - Integration tests with context/providers

## Test Structure
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentName } from '@/components/ComponentName';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

## What to Test
- ✅ Component rendering
- ✅ User interactions (clicks, typing, etc.)
- ✅ Props handling
- ✅ Accessibility (a11y)
- ✅ Component state changes
- ✅ Event handlers

## What NOT to Test
- ❌ Implementation details
- ❌ Third-party library functionality
- ❌ CSS styling (unless functional)

_Created: 2025-11-18_