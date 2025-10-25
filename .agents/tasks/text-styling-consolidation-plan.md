# Text Styling Consolidation Plan
## Simple Approach - No Over-Engineering

**Created:** 2025-10-25
**Status:** Pending Approval
**Estimated Time:** 2 hours
**Complexity:** Low

---

## 📋 Table of Contents

1. [The Problem (With Examples)](#the-problem-with-examples)
2. [The Solution (Simple)](#the-solution-simple)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Expected Results](#expected-results)

---

## The Problem (With Examples)

### Problem 1: Inconsistent Ways to Style Text

**Example 1: Modal text using multiple approaches**

In `src/components/modals/CreateSpaceModal.tsx`:

```tsx
// Line 123 - Using modal class
<div className="modal-text-label">
  <Trans>Space Banner</Trans>
</div>

// Line 125 - Using raw Tailwind (different approach!)
<div className="mt-4 text-sm text-subtle">
  {error.message}
</div>

// Somewhere else - Using Text primitive (yet another approach!)
<Text className="modal-text-small text-main">
  Pin to top
</Text>
```

**The confusion:**
- When should I use `.modal-text-label`?
- When should I use `text-sm`?
- When should I use `<Text>` component?
- **There's no clear answer!**

---

**Example 2: Incomplete modal classes**

In `src/styles/_modal_common.scss`:

```scss
// This class only sets font-size
.modal-text-small {
  font-size: $text-sm;  // Just 14px, nothing else!
}

.modal-text-label {
  font-size: $text-sm;
  font-weight: $font-semibold;
  text-transform: uppercase;
  letter-spacing: $tracking-wider;
}
```

**Then in components, you have to remember to add color:**

**✅ ANSWER TO YOUR NOTE:** You're RIGHT! Text DOES default to `text-main` color!

In `src/styles/_base.scss` line 20:
```scss
:root {
  color: rgb(var(--color-text-main)) !important;  // ← Default text color
}
```

**So this works fine:**
```tsx
<div className="modal-text-small">Username</div>  // ✅ Has text-main color by default
```

**But for semantic clarity, it's better to be explicit when you want different colors:**
```tsx
<div className="modal-text-small text-subtle">Secondary info</div>
<div className="modal-text-small text-main">Primary info</div>
```

**Conclusion:** The modal classes aren't broken, but they're not semantic. The real problem is knowing WHEN to use them vs. Tailwind utilities.

**The confusion:**
- Why do I need two classes?
- Which color should I use?
- What if I forget `text-main`?

---

**Example 3: Small text too small on mobile**

In `src/components/message/MessageComposer.scss`:

```scss
// Line 252 - Reply bar text
.message-composer-reply-bar {
  font-size: $text-xs;  // 12px on ALL devices
}

// Line 409 - Mention addresses
.message-composer-mention-address {
  font-size: $text-xs;  // 12px on ALL devices
}
```

**The problem:**
- 12px is too small on mobile phones
- Hard to read for users
- You already have `$text-xs-responsive` variable that solves this!
- But it's not being used consistently

---

### Problem 2: No Clear Pattern Documented

**When a developer needs to add text, they ask:**
- "Should I use `modal-text-small` or `text-sm`?"
- "Should I use the Text primitive?"
- "What color class should I add?"
- "Is this text responsive or fixed?"

**Answer:** 🤷 No documentation exists!

---

## The Solution (Simple)

### 1. Keep What Works

✅ **Your font sizes are already good:**
- `$text-xs: 12px` ✅
- `$text-sm: 14px` ✅
- `$text-base: 16px` ✅
- `$text-lg: 18px` ✅
- `$text-xs-responsive: 14px mobile → 12px desktop` ✅

**Don't change these!**

---

### 2. Add Semantic Aliases (For Clarity)

Add these to `src/styles/_variables.scss` to make code self-documenting:

```scss
/* ============================================ */
/* MESSAGING-SPECIFIC SEMANTIC ALIASES         */
/* ============================================ */
/* These are just aliases pointing to existing variables */
/* Use these in SCSS files for clearer intent */

// Message content
$font-message: $text-sm;              // 14px - Message text in chat
$font-message-lh: $text-sm-lh;        // Line height for messages

// Input fields (CRITICAL - prevents iOS zoom on mobile)
$font-input: $text-base;              // 16px - All input fields
$font-input-lh: $text-base-lh;        // Line height for inputs

// Small labels that appear on mobile (use responsive)
$font-label-small: $text-xs-responsive;  // 14px mobile → 12px desktop
```

**✅ ANSWER TO YOUR NOTE:** Great catch! Let me check the primitives:

**Input primitive** (`src/components/primitives/Input/Input.scss` line 97):
```scss
.quorum-input {
  font-size: $s-4;  // ⚠️ Uses spacing variable! But $s-4 = 1rem = 16px (correct size, wrong var)
}
```
✅ Already 16px (prevents iOS zoom)
❌ But uses spacing variable `$s-4` instead of text variable `$text-base`

**TextArea primitive** (`src/components/primitives/TextArea/TextArea.scss` line 16):
```scss
.quorum-textarea {
  font-size: $text-base;  // ✅ Correct! 16px using text variable
}
```
✅ Already correct!

**Select primitive** (`src/components/primitives/Select/Select.scss` line 36):
```scss
.quorum-select__trigger {
  font-size: $text-sm;  // 14px (not 16px!)
}
```
⚠️ Select uses 14px, which CAN cause iOS zoom on mobile

**Conclusion:**
- `$font-input` alias is still useful for consistency
- We should fix Input to use `$text-base` instead of `$s-4`
- We should consider fixing Select to use `$text-base` on mobile

**Why?**
- Makes code easier to understand
- `font-size: $font-message` is clearer than `font-size: $text-sm`
- When you see `$font-input`, you know it's for an input field
- No new sizes added, just better names!

---

### 3. Document ONE Simple Pattern

**File to create:** `.agents/docs/guidelines/text-styling-pattern.md`

**The pattern:**

```markdown
# Text Styling Pattern

## Simple Rule
Always use Tailwind utility classes. Combine size + weight + color.

### Common Patterns

**Titles (large headings):**
```tsx
<div className="text-xl font-bold text-strong">Main Title</div>
```

**Subtitles (section headings):**
```tsx
<div className="text-lg font-bold text-main">Section Title</div>
```

**Labels (form labels):**
```tsx
<div className="text-sm font-normal text-subtle">Field Label</div>
```

**Body text:**
```tsx
<div className="text-base text-main">Paragraph content</div>
```

**Small text - Desktop only:**
```tsx
<div className="text-xs text-muted">Timestamp (desktop)</div>
```

**Small text - Mobile + Desktop:**
```tsx
<div className="text-xs-responsive text-muted">Badge</div>
```
```

**Why this pattern?**
- One consistent way to style text
- Uses existing Tailwind classes (no new system needed)
- Easy to remember
- Works everywhere

---

**✅ ANSWER TO YOUR NOTE:** Excellent question! This is the KEY decision point.

**You're suggesting creating compound SCSS classes like:**
```scss
// In _variables.scss or new _typography.scss
.text-title {
  font-size: $text-xl;
  font-weight: $font-bold;
  color: var(--color-text-strong);
}

.text-subtitle {
  font-size: $text-lg;
  font-weight: $font-bold;
  color: var(--color-text-main);
}
```

**Then use like:**
```tsx
<div className="text-title">Title</div>  // Single class!
```

**Pros:**
- ✅ Single class instead of three
- ✅ Semantic naming
- ✅ Consistent styling guaranteed
- ✅ Easy to change globally

**Cons:**
- ❌ Less flexible (can't easily override color)
- ❌ More classes to maintain
- ❌ Mixing SCSS classes with Tailwind (two systems)

**My recommendation:**
1. **If you want SIMPLE and FAST:** Stick with Tailwind utilities (current plan)
2. **If you want STRICT and SEMANTIC:** Create compound SCSS classes (your suggestion)

**HONEST ASSESSMENT:** Your suggestion is actually BETTER for maintainability IF you're willing to:
- Create 5-6 semantic classes
- Put them in a new `src/styles/_typography.scss` file
- Document them clearly

**Would you like me to UPDATE THE PLAN to use compound SCSS classes instead?** This is actually a solid approach and might be better than what I proposed.

---

### 4. Fix Mobile Readability

Replace small fixed text with responsive variant where users interact with it.

**Rule:** If text is on mobile and users need to read it → use `text-xs-responsive`

---

## Step-by-Step Implementation

### Step 1: Add Semantic Aliases (5 minutes)

**File:** `src/styles/_variables.scss`

**Location:** After the existing font size variables (around line 50-60)

**Add this:**

```scss
/* ============================================ */
/* MESSAGING-SPECIFIC SEMANTIC ALIASES         */
/* ============================================ */
/* Use these in SCSS files for self-documenting code */
/* They point to existing variables - no new sizes */

// Message content - main chat text
$font-message: $text-sm;              // 14px - Message text
$font-message-lh: $text-sm-lh;        // 20px - Line height

// Input fields - CRITICAL for mobile (prevents iOS zoom)
$font-input: $text-base;              // 16px - Must be 16px+ on mobile
$font-input-lh: $text-base-lh;        // 24px - Line height

// Small labels - responsive for mobile readability
$font-label-small: $text-xs-responsive;  // 14px mobile → 12px desktop

/* Usage examples:
 *
 * .message-content {
 *   font-size: $font-message;        // Clearer than $text-sm
 *   line-height: $font-message-lh;
 * }
 *
 * .message-input {
 *   font-size: $font-input;          // Clearly an input field
 * }
 *
 * .badge {
 *   font-size: $font-label-small;    // Responsive on mobile
 * }
 */
```

**Before:**
```scss
$text-xs: 0.75rem;       /* 12px */
$text-sm: 0.875rem;      /* 14px */
$text-base: 1rem;        /* 16px */
// ... rest of variables
```

**After:**
```scss
$text-xs: 0.75rem;       /* 12px */
$text-sm: 0.875rem;      /* 14px */
$text-base: 1rem;        /* 16px */
// ... rest of variables

/* ============================================ */
/* MESSAGING-SPECIFIC SEMANTIC ALIASES         */
/* ============================================ */
$font-message: $text-sm;
$font-message-lh: $text-sm-lh;
$font-input: $text-base;
$font-input-lh: $text-base-lh;
$font-label-small: $text-xs-responsive;
```

---

### Step 2: Fix Mobile Small Text (30 minutes)

#### File 1: `src/components/message/MessageComposer.scss`

**Location: Line ~252**

**BEFORE:**
```scss
.message-composer-reply-bar {
  margin-left: $s-3;
  margin-right: $s-3;
  margin-top: $s-2;
  padding-left: $s-2;
  padding-right: $s-2;
  padding-top: $s-1;
  padding-bottom: $s-1;
  cursor: pointer;
  font-size: $text-xs;  // ❌ 12px on ALL devices (too small on mobile)
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: var(--surface-4);
}
```

**AFTER:**
```scss
.message-composer-reply-bar {
  margin-left: $s-3;
  margin-right: $s-3;
  margin-top: $s-2;
  padding-left: $s-2;
  padding-right: $s-2;
  padding-top: $s-1;
  padding-bottom: $s-1;
  cursor: pointer;
  font-size: $text-xs-responsive;  // ✅ 14px on mobile, 12px on desktop
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: var(--surface-4);
}
```

**Why?**
- Reply bar appears on mobile when replying to messages
- 12px is too small to read on phone screens
- Responsive variant makes it 14px on mobile (readable)
- Still 12px on desktop (for density)

---

**Location: Line ~409**

**BEFORE:**
```scss
.message-composer-mention-address {
  font-size: $text-xs;  // ❌ 12px everywhere
  color: var(--color-text-subtle);
}
```

**AFTER:**
```scss
.message-composer-mention-address {
  font-size: $text-xs-responsive;  // ✅ 14px mobile, 12px desktop
  color: var(--color-text-subtle);
}
```

**Why?**
- Mention dropdown appears when typing @username
- Users need to read addresses on mobile
- 12px too small on phones

---

**Location: Line ~430**

**BEFORE:**
```scss
.message-composer-mention-role-tag {
  font-size: $text-xs;  // ❌ 12px everywhere
  color: var(--color-text-main);
  font-weight: $font-medium;
}
```

**AFTER:**
```scss
.message-composer-mention-role-tag {
  font-size: $text-xs-responsive;  // ✅ 14px mobile, 12px desktop
  color: var(--color-text-main);
  font-weight: $font-medium;
}
```

**Why?**
- Role tags in mention dropdown
- Need to be readable on mobile

---

#### File 2: Find Other Occurrences

**Run this command to find all `$text-xs` usage:**

```bash
cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && grep -n 'font-size: \$text-xs' src/components --include='*.scss' -r"
```

**For each occurrence, ask:**
1. Does this appear on mobile? → If YES, change to `$text-xs-responsive`
2. Is it desktop-only (like dense tables)? → Keep `$text-xs`

**Common places to check:**
- Form labels in modals
- Badges and counts
- Timestamps in compact views
- Metadata in lists

---

### Step 3: Document the Pattern (15 minutes)

**Create file:** `.agents/docs/guidelines/text-styling-pattern.md`

**Content:**

```markdown
# Text Styling Pattern
## Simple, Consistent Approach

**Last updated:** 2025-10-25

---

## The Rule

**Use Tailwind utility classes to style text.** Combine three things:

1. **Size** - `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`
2. **Weight** - `font-normal`, `font-medium`, `font-semibold`, `font-bold`
3. **Color** - `text-main`, `text-subtle`, `text-muted`, `text-strong`

---

## Common Patterns

### Titles (Large Headings)

```tsx
<div className="text-xl font-bold text-strong">
  Main Page Title
</div>
```

**When:** Modal titles, page headers, main headings

---

### Subtitles (Section Headings)

```tsx
<div className="text-lg font-bold text-main">
  Section Title
</div>
```

**When:** Section dividers, group headers

---

### Labels (Form Labels, UI Labels)

```tsx
<div className="text-sm font-normal text-subtle">
  Field Label
</div>
```

**When:** Input labels, metadata labels, descriptive text

---

### Body Text (Normal Content)

```tsx
<div className="text-base text-main">
  This is normal paragraph content.
</div>
```

**When:** Message content, descriptions, main text

---

### Small Text - IMPORTANT: Mobile vs Desktop

**Desktop Only (dense UI, tables):**
```tsx
<div className="text-xs text-muted">
  Desktop timestamp
</div>
```

**Mobile + Desktop (interactive elements):**
```tsx
<div className="text-xs-responsive text-muted">
  Badge count
</div>
```

**Rule:** If users interact with it on mobile → use `text-xs-responsive`

---

## Real Examples from Codebase

### Example 1: Modal Label

**✅ Good:**
```tsx
<div className="text-sm font-semibold text-main uppercase tracking-wider">
  <Trans>Username</Trans>
</div>
```

**❌ Bad:**
```tsx
<div className="modal-text-label">  {/* Incomplete, needs color class */}
  <Trans>Username</Trans>
</div>
```

---

### Example 2: Error Message

**✅ Good:**
```tsx
<div className="mt-4 text-sm text-danger">
  {error.message}
</div>
```

**❌ Bad:**
```tsx
<div className="modal-text-small">  {/* No color! */}
  {error.message}
</div>
```

---

### Example 3: Small Badge on Mobile

**✅ Good:**
```tsx
<div className="text-xs-responsive font-medium text-subtle">
  12 online
</div>
```

**❌ Bad:**
```tsx
<div className="text-xs font-medium text-subtle">  {/* Too small on mobile! */}
  12 online
</div>
```

---

## When to Use `text-xs-responsive`

### ✅ Use Responsive For:

- Form labels (users fill forms on mobile)
- Badges and counts (users read these on mobile)
- Metadata in interactive lists
- Secondary descriptive text users read on mobile

### ❌ Keep Fixed `text-xs` For:

- Desktop-only dense tables
- Admin panels (desktop-focused)
- Tooltips that only appear on desktop hover

**If in doubt:** Use `text-xs-responsive` (safer for mobile)

---

## SCSS Variables for Component Styles

When writing component SCSS files, you can use semantic aliases:

```scss
.message-content {
  font-size: $font-message;        // 14px - clear intent
  line-height: $font-message-lh;
}

.message-input {
  font-size: $font-input;          // 16px - prevents iOS zoom
}

.badge {
  font-size: $font-label-small;    // responsive
}
```

**Available aliases:**
- `$font-message` - Message text (14px)
- `$font-input` - Input fields (16px)
- `$font-label-small` - Small labels (responsive)

---

## Migration: Moving Away from Modal Classes

**Old modal classes are being phased out:**
- `.modal-text-label` → Use pattern above
- `.modal-text-small` → Use pattern above
- `.modal-text-section-header` → Use pattern above

**Why?**
- Incomplete (don't set color)
- Not reusable outside modals
- Harder to understand

**Migration is gradual - both work for now**

---

## Quick Reference Card

| Use Case | Size | Weight | Color | Example |
|----------|------|--------|-------|---------|
| Page title | `text-xl` | `font-bold` | `text-strong` | Modal title |
| Section header | `text-lg` | `font-bold` | `text-main` | Settings section |
| Form label | `text-sm` | `font-normal` | `text-subtle` | "Username" |
| Body text | `text-base` | `font-normal` | `text-main` | Description |
| Badge (mobile) | `text-xs-responsive` | `font-medium` | `text-muted` | Count badge |
| Timestamp (desktop) | `text-xs` | `font-normal` | `text-muted` | Dense tables |

---

**Questions?** Check `.agents/tasks/text-styling-consolidation-plan.md` for detailed rationale.
```

---

### Step 4: Update AGENTS.md (10 minutes)

**File:** `.agents/AGENTS.md`

**Location:** In the section about styling or component patterns

**Add this:**

```markdown
### Text Styling Pattern

**Use Tailwind utility classes** to style text. Combine size + weight + color:

```tsx
// Title
<div className="text-xl font-bold text-strong">Title</div>

// Subtitle
<div className="text-lg font-bold text-main">Subtitle</div>

// Label
<div className="text-sm font-normal text-subtle">Label</div>

// Small text on mobile
<div className="text-xs-responsive text-muted">Badge</div>
```

**Key rule:** For small text on mobile, use `text-xs-responsive` instead of `text-xs`

**See:** [Text Styling Pattern Guide](.agents/docs/guidelines/text-styling-pattern.md)
```

---

## Expected Results

### Before This Plan

**Developer experience:**
```tsx
// Developer: "How should I style this label?"
// 🤷 "Uhh... I see modal-text-label used sometimes..."
// 🤷 "But also text-sm in other places..."
// 🤷 "Do I need to add a color class?"
// Result: Inconsistent code

<div className="modal-text-label">Username</div>
// vs
<div className="text-sm text-main">Username</div>
// vs
<Text className="modal-text-small text-main">Username</Text>
```

**Mobile user experience:**
- Small text (12px) hard to read on phones
- Reply bar text too small
- Mention dropdown text too small

---

### After This Plan

**Developer experience:**
```tsx
// Developer: "How should I style this label?"
// ✅ "Check the pattern doc... text-sm font-normal text-subtle"
// Result: Consistent code everywhere

<div className="text-sm font-semibold text-main uppercase tracking-wider">
  Username
</div>
```

**Mobile user experience:**
- Small interactive text → 14px (readable!)
- Reply bar → 14px on mobile
- Mention dropdown → 14px on mobile
- Desktop keeps 12px for density

---

### Metrics

**Before:**
- ❌ 3 different ways to style text
- ❌ No documentation
- ❌ 12px text on mobile (too small)
- ❌ Modal classes incomplete (require color class)

**After:**
- ✅ 1 documented pattern
- ✅ Clear examples in guide
- ✅ 14px responsive text on mobile
- ✅ Self-documenting semantic aliases

---

## What We're NOT Doing (Avoiding Over-Engineering)

❌ **NOT creating semantic classes** (`.text-title`, `.text-subtitle`)
- Too much new code
- Another layer of abstraction
- Migration burden

❌ **NOT enhancing Text primitive** with variants
- Complex refactoring
- High risk
- Not needed for the problem

❌ **NOT creating design token system**
- Overkill for current needs
- Can add later if mobile app needs it

❌ **NOT removing modal classes yet**
- Let them phase out naturally
- No rush
- Focus on new code following pattern

---

## Testing Checklist

After implementing:

**Mobile Testing:**
- [ ] Open on iPhone/Android
- [ ] Look at reply bar (should be 14px, readable)
- [ ] Open mention dropdown (should be 14px, readable)
- [ ] Check any modals with small text
- [ ] Verify nothing looks broken on desktop

**Code Testing:**
- [ ] Run TypeScript check: `cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit"`
- [ ] Run build: `cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && yarn build"`
- [ ] Check for SCSS errors

**Documentation Testing:**
- [ ] Can a new developer find the pattern guide?
- [ ] Are examples clear?
- [ ] Is the pattern easy to follow?

---

## Summary

**Problem:** Text styling is inconsistent and confusing. Small text too small on mobile.

**Solution:**
1. Add semantic aliases for clarity (no new sizes)
2. Fix mobile readability (use responsive variants)
3. Document ONE simple pattern
4. Update quick reference in AGENTS.md

**Time:** 2 hours

**Risk:** Very low (minimal code changes)

**Benefit:** Clear pattern, better mobile UX, easier maintenance

---

_Last updated: 2025-10-25_
