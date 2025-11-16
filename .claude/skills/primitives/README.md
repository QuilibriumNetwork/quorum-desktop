# Cross-Platform Primitives Skill

This skill provides expert guidance for Quorum Desktop's cross-platform primitive system. It helps make architectural decisions, design components, and maintain consistency across web and mobile platforms.

## Skill Files

- **`SKILL.md`** - Main skill definition and expertise areas
- **`decision-framework.md`** - 5-question framework for systematic decisions
- **`examples/component-patterns.md`** - Real-world good vs bad examples
- **`templates/new-component-template.tsx`** - Template for new components
- **`templates/new-primitive-template.tsx`** - Template for new primitives

## When This Skill Activates

The skill automatically activates when Claude detects context related to:
- Designing React components
- Refactoring UI elements
- Choosing between primitives and raw HTML
- Working with .web/.native file structure
- Migrating web components to cross-platform
- Creating new primitives
- Making architectural decisions for the hybrid primitive system

**🚨 CRITICAL FEATURE: API Verification**
This skill ALWAYS checks the [API Reference](../../.agents/docs/features/primitives/API-REFERENCE.md) before suggesting primitive usage to ensure accurate prop names and prevent hallucination.

## Quick Test

To test if the skill is working, try phrases like:
- "I need to create a new modal component"
- "Should I use primitives for this data table?"
- "Help me refactor this component to be cross-platform"
- "I'm building a form, what's the best approach?"

## Skill Architecture

This skill follows the strategic primitive usage principles:

### STRICT RULES (Always primitives)
- Interactive elements: Button, Input, Select, Modal, Switch
- Component boundaries: Modal wrappers, screen containers

### CONDITIONAL RULES (Use when compatible)
- Typography: Text, Paragraph, Title (fallback to HTML when issues arise)

### FLEXIBLE RULES (Case-by-case)
- Layout containers: Primitives for simple patterns, raw HTML for complex layouts
- Apply the 5-question decision framework for guidance

## Integration

The skill references and aligns with:
- Project primitives documentation (`.agents/docs/features/primitives/`)
- Styling guidelines (`.agents/docs/styling-guidelines.md`)
- Cross-platform architecture guides
- Agents workflow documentation

This ensures all recommendations are consistent with established project patterns and conventions.