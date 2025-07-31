Update src/dev/components-audit/audit.json using this script: src/dev/components-audit/update_audit.py - update the detailes for the component we have just worked on and then update the general stats at the end of the json.

RULES to categorize a component:
- **shared**: Only if component uses ONLY primitives + business logic hooks (no custom CSS/SCSS)
- **platform_specific**: If component has ANY of:
  - Custom .scss file or CSS classes 
  - Tailwind/raw HTML elements (div, span, etc.)
  - Web-specific libraries (react-virtuoso, FontAwesome, etc.)
  - Complex UI patterns (drag/drop, virtualization, tooltips)
- **complex_refactor**: 500+ lines with multiple concerns needing major refactoring

- **Native** categories: is "Ready" only if there is a native components ready or the component is **shared** AND it's been tested succesfully on mobile - in most cases it will be **todo**

**EVALUATE CASE BY CASE**: Simple CSS fixes vs separate components
- If 1-2 simple CSS classes can be replaced with primitives → make **shared**
- If complex SCSS, multiple classes, or web-specific behavior → keep **platform_specific**
- Consider: "Is it easier to fix or rebuild for native?"
- If you classify as **shared** but it contains some css classes, add a note explaining the situation

QUICK CHECK: If you see `import './Component.scss'` or `className="custom-class"` → evaluate effort to fix
