# Test Manager Skill

This Claude Skill automatically manages test creation, organization, and maintenance for the Quorum Desktop project.

## How It Works

The skill **automatically activates** when Claude detects you're working on tasks that should include testing:

- Implementing new features or components
- Fixing bugs or refactoring code
- Creating utilities or services
- Adding React components or hooks

## What It Does

### 🔍 Intelligent Test Detection
- Analyzes your request to determine what type of tests are needed
- Follows the project's established testing philosophy and patterns
- Considers the code type (service, component, utility, etc.)

### 🏗️ Automatic Test Creation
- Creates appropriately structured tests using project templates
- Places tests in the correct directory based on type
- Uses proper naming conventions and file organization
- Includes comprehensive test cases and edge conditions

### 📋 Documentation Management
- Updates README files when test structure changes
- Maintains test statistics and coverage information
- Keeps category documentation current

### ⚡ Test Execution
- Runs appropriate test suites to verify functionality
- Uses proper test commands for the development environment
- Provides clear feedback on test results

## File Structure

```
.claude/skills/test-manager/
├── SKILL.md                 # Main skill definition and instructions
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
    └── update-test-docs.js # Documentation update automation
```

## Templates Available

### Service Test Template
- Unit tests for business logic classes
- Mocked dependencies and database operations
- Method signature validation
- Error handling and edge cases

### Component Test Template
- React component rendering tests
- User interaction testing
- Accessibility compliance
- Props validation and state management

### Utility Test Template
- Pure function testing
- Edge case and boundary condition coverage
- Performance testing for critical utilities
- Error recovery and validation

### Hook Test Template
- Custom React hook testing
- State management and effect testing
- Cleanup and dependency validation
- Integration with React features

## Testing Philosophy

**What We Test:**
- ✅ Service construction and method behavior
- ✅ Component rendering and user interactions
- ✅ Utility function logic and edge cases
- ✅ Hook state management and effects
- ✅ Error handling and validation
- ✅ Integration workflows

**What We Don't Test:**
- ❌ Third-party library functionality
- ❌ Implementation details
- ❌ Framework code (React, Vitest, etc.)
- ❌ Trivial pass-through functions

## Organization Strategy

Tests are organized by type and functionality:
- `services/` - Business logic and data handling
- `utils/` - Pure functions and helpers
- `components/` - React UI components
- `hooks/` - Custom React hooks
- `integration/` - Multi-component workflows
- `e2e/` - Complete user journeys

## Activation Examples

The skill activates automatically when you:

```
"Add a new message composer component"
→ Creates component tests, considers integration tests

"Fix bug in space deletion service"
→ Creates regression tests, updates service tests

"Refactor mention highlighting utility"
→ Ensures existing tests pass, adds new test cases

"Create custom hook for API calls"
→ Creates hook tests with proper mocking
```

## Benefits

### 🚀 Productivity
- No need to remember testing standards
- Automatic test generation with proper structure
- Templates eliminate boilerplate writing

### 🛡️ Quality
- Consistent testing approach across the project
- Comprehensive coverage of edge cases
- Proper mocking and isolation strategies

### 👥 Team Alignment
- Shared testing standards via version control
- Onboarding simplified with automatic guidance
- Documentation stays current automatically

### 📈 Maintenance
- Test organization scales with project growth
- Easy to find and update tests
- Clear documentation for troubleshooting

## Customization

The skill can be customized by modifying:
- `SKILL.md` - Core behavior and decision logic
- `examples/` - Test templates for your patterns
- `guidelines/` - Project-specific testing criteria
- `scripts/` - Automation and maintenance tools

## Integration with Development Workflow

1. **Feature Development**: Skill suggests and creates tests alongside code
2. **Bug Fixing**: Automatic regression test creation
3. **Refactoring**: Ensures test compatibility and adds missing coverage
4. **Code Review**: Tests are included and properly structured
5. **Documentation**: README files stay current with minimal effort

---

_This skill ensures consistent, comprehensive testing practices across the Quorum Desktop project without requiring manual process management._