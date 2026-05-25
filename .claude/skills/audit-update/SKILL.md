---
name: audit-update
description: Use when the user asks to update the component audit, categorize a component as shared/platform/complex, or refresh `src/dev/components-audit/audit.json` after working on a component. Triggers on "update audit", "audit this component", "categorize component", "refresh audit stats".
---

# Update Component Audit

Refresh `src/dev/components-audit/audit.json` to reflect the categorization of the component just worked on, then update the global stats at the end of the JSON.

## How to run

Use the script: `src/dev/components-audit/update_audit.py`.

Update the entry for the component just touched, then recompute the aggregate stats block at the bottom of the JSON.

## Categorization rules

- **shared**: component uses ONLY primitives + business logic hooks (no custom CSS/SCSS, no raw HTML, no web-only libs).
- **platform_specific**: component has ANY of:
  - Custom `.scss` file or CSS classes
  - Tailwind / raw HTML elements (`div`, `span`, etc.)
  - Web-specific libraries (`react-virtuoso`, FontAwesome, etc.)
  - Complex UI patterns (drag/drop, virtualization, tooltips)
- **complex_refactor**: 500+ lines with multiple concerns needing major refactoring.

**Native column**: mark `Ready` only if a native component exists OR the component is **shared** AND tested successfully on mobile. Otherwise → **todo**.

## Evaluate case by case

Simple CSS fixes vs separate components is a judgment call:

- 1–2 simple CSS classes that could be replaced with primitives → **shared**
- Complex SCSS, multiple classes, or web-specific behavior → **platform_specific**
- Ask: "Is it easier to fix or rebuild for native?"
- If classified as **shared** but it still contains some CSS classes, add a note explaining why.

## Quick check

If you see `import './Component.scss'` or `className="custom-class"`, stop and evaluate the effort to fix before categorizing.
