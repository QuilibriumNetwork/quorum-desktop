# Utility Tests

Tests for utility functions and helper modules.

## Current Tests

| File | Tests | Description |
|------|-------|-------------|
| `reservedNames.test.ts` | 42 | Homoglyph normalization, mention keywords, impersonation detection, name classification |
| `mentionUtils.enhanced.test.ts` | 31 | Mention extraction (user/channel/role/@everyone), backward compat, rate limiting |
| `mentionHighlighting.test.ts` | 20 | Mention detection, HTML highlighting, code block exclusion, performance |
| `messageGrouping.unit.test.ts` | 13 | Day boundaries, date separators, date labels, message grouping |

**Total: 106 tests**

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
- Function return values
- Input validation
- Edge cases (null, empty, undefined)
- Error handling
- Performance (for critical utils)

_Last updated: 2026-03-18_
