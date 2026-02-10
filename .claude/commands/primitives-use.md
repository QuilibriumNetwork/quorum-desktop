---
description: Convert components to use primitive components architecture
argument-hint: [component-name]
---

Convert this component ($ARGUMENTS) to use our src/components/primitives (docs:.agents\docs\features\primitives).

Priority:

1. **Use primitive props first**:
   - Button: `type="primary|secondary|danger"`, `size="small|normal"`
   - Layout: `<FlexRow gap="sm" justify="between">` vs `className="flex"`
   - Text (native only): `variant="strong|subtle|muted"`, `size="sm|base|lg"`

2. **For text on web**: Use plain HTML (`<span>`, `<p>`) with CSS typography classes (`.text-strong`, `.text-subtle`, `.text-label`, `.text-small`). The Text primitive is **native-only** — not used in web production code.

3. **If props aren't enough**: Use Tailwind (`bg-surface-0`, `text-strong`)
4. **Last resort**: Existing CSS or hardcoded styles
