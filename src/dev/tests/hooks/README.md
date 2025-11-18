# Hook Tests

React custom hooks testing.

## Naming Convention
- `useHookName.test.ts` - Custom hook tests

## Test Structure
```typescript
import { renderHook, act } from '@testing-library/react';
import { useHookName } from '@/hooks/useHookName';

describe('useHookName', () => {
  it('should return initial state', () => {
    const { result } = renderHook(() => useHookName());
    expect(result.current.value).toBe(initialValue);
  });

  it('should update state correctly', () => {
    const { result } = renderHook(() => useHookName());

    act(() => {
      result.current.updateValue(newValue);
    });

    expect(result.current.value).toBe(newValue);
  });
});
```

## What to Test
- ✅ Hook return values
- ✅ State updates
- ✅ Effect dependencies
- ✅ Error handling
- ✅ Cleanup functions

## Tools
- `@testing-library/react-hooks` for hook testing
- `renderHook` for isolated hook testing
- `act` for state updates

_Created: 2025-11-18_