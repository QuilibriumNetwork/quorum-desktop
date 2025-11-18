# End-to-End Tests

Full application tests simulating real user scenarios.

## Naming Convention
- `userFlow.e2e.test.ts` - User journey tests
- `critical.e2e.test.ts` - Critical path tests

## Test Structure
```typescript
import { test, expect } from '@playwright/test';

test.describe('User Authentication Flow', () => {
  test('should allow user to login and access dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'user@example.com');
    await page.fill('[data-testid=password]', 'password');
    await page.click('[data-testid=login-button]');

    await expect(page.locator('[data-testid=dashboard]')).toBeVisible();
  });
});
```

## What to Test
- ✅ Critical user journeys
- ✅ Cross-browser compatibility
- ✅ Performance benchmarks
- ✅ Accessibility compliance
- ✅ Mobile responsiveness
- ✅ Real data scenarios

## Tools
- **Playwright** - Primary E2E framework
- **Real browsers** - Chrome, Firefox, Safari
- **Real backend** - Full stack testing
- **Performance monitoring** - Core Web Vitals

## Test Environment
- Staging environment
- Real database with test data
- All services running
- Performance monitoring enabled

_Created: 2025-11-18_