# Test Manager Skill

This Claude Skill automatically manages test creation, organization, and maintenance for the Quorum Desktop project.

## How It Works

The skill **automatically activates** when Claude detects you're working on tasks that should include testing:

- Implementing new features or components
- Fixing bugs or refactoring code
- Creating utilities or services
- Adding React components or hooks

## What It Does

### Intelligent Test Detection
- Analyzes your request to determine what type of tests are needed
- Follows the project's established testing philosophy and patterns
- Considers the code type (service, component, utility, db, etc.)

### Automatic Test Creation
- Creates appropriately structured tests using project templates
- Places tests in the correct directory based on type
- Uses proper naming conventions and file organization
- Includes comprehensive test cases and edge conditions

### Documentation Management
- Reminds you to update README files when test structure changes
- Points to `src/dev/tests/README.md` as the source of truth for inventory

### Test Execution
- Runs appropriate test suites to verify functionality
- Uses proper test commands for the development environment

## File Structure

```
.claude/skills/test-manager/
├── SKILL.md                 # Main skill definition (process & rules)
├── README.md               # This documentation
├── examples/               # Test templates
│   ├── service-test-template.tsx
│   ├── component-test-template.tsx
│   ├── utility-test-template.ts
│   └── hook-test-template.ts
├── guidelines/             # Testing guidelines and decision criteria
│   ├── when-to-test.md
│   └── test-categories.md
└── scripts/
    └── update-test-docs.js
```

## Source of Truth

The skill defines **process** (how to test, where to put things, naming conventions). For **inventory** (what tests exist, test counts, detailed descriptions), always read:

- `src/dev/tests/README.md` — main index
- `src/dev/tests/[category]/README.md` — per-category details

## Organization Strategy

Tests are organized by type in `src/dev/tests/`:

| Directory | Purpose |
|-----------|---------|
| `services/` | Business logic and data handling |
| `utils/` | Pure functions and helpers |
| `components/` | React UI components |
| `db/` | Database store operations |
| `hooks/` | Custom React hooks |
| `integration/` | Multi-component workflows |
| `e2e/` | Complete user journeys |

## Testing Philosophy

**What We Test:**
- Service construction and method behavior
- Component rendering and user interactions
- Utility function logic and edge cases
- Hook state management and effects
- Database store CRUD operations
- Error handling and validation

**What We Don't Test:**
- Third-party library functionality
- Implementation details
- Framework code (React, Vitest, etc.)
- Trivial pass-through functions

## Customization

The skill can be customized by modifying:
- `SKILL.md` - Core behavior and decision logic
- `examples/` - Test templates for your patterns
- `guidelines/` - Project-specific testing criteria
