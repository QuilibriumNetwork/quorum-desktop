# css-refactor-plan.md

## 🎯 Objective

Migrate the existing SCSS-based styling system (using semantic class names and raw CSS) into a unified Tailwind-based system using `@apply`, Tailwind utility classes, and theme tokens. This refactor will preserve semantic class naming, reduce custom CSS, and align all design logic with the existing Tailwind configuration and design tokens.

---

## 🧱 Project Context

- The project uses SCSS for styling, with both shared and component-scoped `.scss` files.
- Tailwind CSS is already configured and includes semantic tokens (colors, backgrounds, borders, etc.) and a safelist for dynamic classes.
- There are already some semantic classes defined using Tailwind.
- Many raw SCSS files still use traditional CSS declarations (`display: flex`, `margin`, etc.) instead of `@apply`.

---

## 🗂 File Structure Affected

**Component-level SCSS files:**
- `ToggleSwitch.scss`
- `Tooltip.scss`
- `TooltipButton.scss`
- `TooltipDivider.scss`

**Common/shared SCSS files in `src/styles/`:**
- `_base.scss`
- `_chat.scss`
- `_colors.scss`
- `_components.scss`
- `_modal_common.scss` ← **high priority**

---

## 🧩 Migration Philosophy

- 🟢 **Preserve semantic class names** (e.g. `.modal-body`, `.btn-primary`)
- ⚪ **Replace raw CSS declarations with `@apply`** using Tailwind classes
- 🔴 **Avoid writing new raw CSS unless absolutely necessary**

---

# Note on Using `@apply` in SCSS vs Converting to Pure Tailwind CSS

When converting a raw SCSS file to use Tailwind's utility classes via `@apply`, you have two main options:

1. **Keep the files as SCSS and use `@apply` inside them**  
   - **Pros:**  
     - Retain SCSS features like nesting, variables, and `@extend` for modular, maintainable styles.  
     - Combine Tailwind utilities with SCSS logic for flexibility.  
   - **Cons:**  
     - Requires a more complex build process: SCSS must be compiled *before* Tailwind’s PostCSS processes `@apply`.  
     - Debugging can be harder due to interplay of two preprocessors.  
     - Team members unfamiliar with this setup might find it confusing.

2. **Convert everything to plain CSS files using `@apply` only**  
   - **Pros:**  
     - Simpler build pipeline—Tailwind processes `@apply` directly in CSS.  
     - Easier to maintain if you rely purely on Tailwind utilities.  
   - **Cons:**  
     - Lose SCSS features like nesting, variables, and mixins, which might reduce code reusability.  
     - Might require more verbose or repetitive CSS if complex styles are needed.

**Summary:**  
Keeping SCSS with `@apply` offers powerful flexibility but demands a careful build setup and can add complexity. Converting to pure CSS with `@apply` simplifies tooling but sacrifices SCSS advantages. Choose based on project scale, team skillset, and how much SCSS logic you need alongside Tailwind utilities.


---

## 🔍 Step 0: Analisis
Analyze the situation and the current css/scss files. Think hard about it. Is our objective a good one? Could we lose functionality if we go down this path? Is there a better solution?

Whne you have formulated a detailed opinion, report in `.claude\tasks\ongoing\css-refactor\analysis.md`. DO NOT proceed to Step 1 until the user reads the analisis and confirm you to proceed.

## 🔍 Step 1: Full CSS Inventory

Create a file `css-inventory.md` with:
- A list of **all selectors** from each SCSS file
- Tag each selector as:
  - `@apply-convertible`
  - `theme-token` (uses `var(--*)`)
  - `custom-logic` (complex behavior, leave for now)

---

## 🗂 Step 2: Categorize Styles

Each SCSS file is reviewed and styles are grouped into:

| Category | Strategy |
|----------|----------|
| Shared layout/utilities (`_modal_common.scss`) | Move to `styles/modal.css` using `@apply` |
| Component-specific styles | Convert to Tailwind utility classes inside `.tsx` files if simple, or create scoped semantic classes with `@apply` |
| Base/theme styles (`_colors.scss`, `_base.scss`) | Ensure they are already expressed via Tailwind tokens or theme extensions |

---

## ✍️ Step 3: Migrate SCSS to Tailwind Classes with `@apply`

### Example Conversion

From `_modal_common.scss`:
```scss
.modal-body {
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  text-align: center;

  @media (max-width: 768px) {
    gap: 16px;
  }
}
```

➡ Becomes:

```css
/* styles/modal.css */
.modal-body {
  @apply flex justify-between flex-col text-center;

  @screen md {
    @apply gap-4;
  }
}
```

- Use `@screen sm`, `md`, `lg`, etc. instead of raw media queries
- Map spacing to closest Tailwind values (`gap-4`, `mx-4`, etc.)
- For `max-width: 500px`, use `max-w-[500px]` (Tailwind allows arbitrary values)

---

## 🧠 Step 4: Component-by-Component Migration

For each component with a `.scss` file:

1. Identify if styles can be replaced inline with Tailwind classes  
2. If repeated across components → move to a shared semantic class  
3. If unique but verbose → create `component.css` file with semantic `@apply` styles

Track this process in `refactor-status.md`.

---

## 🧪 Step 5: Regression Testing

For each migration:

- Visually test with Tailwind dev tools enabled
- Compare with previous screenshots (`.claude/screenshots/`)
- Test both light and dark modes
- Test responsiveness across breakpoints

---

## 🧹 Step 6: Remove Raw SCSS

- After successful migration and testing:
  - Delete the original `.scss` file
  - Remove imports from components
  - Ensure PurgeCSS is still purging unused classes

---

## 📐 Naming & Convention Guidelines

- Use `kebab-case` for semantic class names (`.modal-footer`, `.chat-input`, `.btn-primary`)
- Keep semantic classes grouped in `/styles/*.css`
- Avoid redefining Tailwind tokens in SCSS
- Always map to Tailwind values (spacing, color, radius) where possible

---

## ⚙️ Tailwind Config Alignment

The existing `tailwind.config.js` already includes:

- Semantic tokens for color, surface, text, and borders
- A `safelist` for dynamic classes
- Responsive utility support with `@screen`

**No config change needed.**

---

## 📁 Files to Deliver - in .claude\tasks\ongoing\css-refactor

- `css-inventory.md` — All SCSS selectors tagged and classified
- `refactor-status.md` — Progress log for each file/component
- `/styles/*.css` — All converted semantic classes with `@apply`
- Updated Tailwind-based components
- `.claude/screenshots/` updated as needed


---

## ✅ Final Goal

- All shared and component styles use Tailwind via `@apply`
- No raw CSS remains unless required for complex cases
- One unified styling philosophy across the project
- Easy onboarding and contribution with semantic + Tailwind clarity
