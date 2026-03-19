# Component Tests

React component unit and integration tests.

## Current Tests

| File | Tests | Description |
|------|-------|-------------|
| `Button.test.tsx` | 27 | Type/size variants, disabled state, icons, tooltips, click handling, a11y |
| `Modal.test.tsx` | 14 | Visibility, sizing, close/escape handling, a11y (role, aria-modal) |
| `ThreadListItem.test.tsx` | 6 | Title rendering, closed thread icon, click handling, reply counts |
| `ThreadsListPanel.test.tsx` | 5 | Section headers, empty state, search filtering, no-results |

**Total: 52 tests**

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
- Component rendering
- User interactions (clicks, typing, etc.)
- Props handling
- Accessibility (a11y)
- Component state changes
- Event handlers

## What NOT to Test
- Implementation details
- Third-party library functionality
- CSS styling (unless functional)

_Last updated: 2026-03-18_
