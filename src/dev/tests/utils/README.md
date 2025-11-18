# Utility Tests

Tests for utility functions and helper modules.

## Naming Convention
- `utilityName.test.ts` - Standard utility tests
- `utilityName.unit.test.ts` - Pure unit tests with mocks

## Test Structure
```typescript
import { utilityFunction } from '../../../utils/utilityName';

describe('utilityName', () => {
  describe('functionName', () => {
    it('should return expected result for valid input', () => {
      const result = utilityFunction(validInput);
      expect(result).toBe(expectedOutput);
    });

    it('should handle edge cases', () => {
      expect(utilityFunction('')).toBe(defaultValue);
      expect(utilityFunction(null)).toBe(defaultValue);
    });
  });
});
```

## What to Test
- ✅ Function return values
- ✅ Input validation
- ✅ Edge cases (null, empty, undefined)
- ✅ Error handling
- ✅ Performance (for critical utils)

## Current Tests
- `messageGrouping.unit.test.ts` - Message grouping utilities
- `mentionHighlighting.test.ts` - Mention highlighting functionality
- `mentionUtils.enhanced.test.ts` - Mention extraction utilities

_Created: 2025-11-18_