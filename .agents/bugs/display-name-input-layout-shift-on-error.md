---
title: Display Name Input - Layout Shift When Error Appears
status: solved
priority: low
area: onboarding
---

# Bug: Display Name Input Grows Wider When Validation Error Appears

## Description

In the `DisplayNameStep` onboarding step, when the user types a name that triggers a validation error (e.g. "admin"), the error message text below the input is wider than the input itself, causing the entire `.onboarding-input-wrapper` to expand horizontally. This makes the name input visibly wider than the account address input below it.

## Root Cause

The `.onboarding-input-wrapper` uses `width: fit-content`, which sizes the wrapper to its widest child. The `.input-container` is a flex column containing the `<input>` and the `.input-error-message` div. When the error message text (e.g. "Names resembling admin, moderator, or support are reserved.") is wider than the input element, it becomes the widest child, and `fit-content` expands the wrapper to accommodate it. The `<input>` then stretches to match via `width: 100%`.

## Approaches Tried and Rejected

### 1. `min-height` on `.input-container`
Solved a vertical shift problem that wasn't the actual bug. The issue was horizontal, not vertical.

### 2. `reserveErrorSpace` prop on Input component
Added a new prop to `quorum-shared` Input to always render a hidden spacer. Also addressed the wrong problem (vertical space reservation). Additionally, backward-compatibility audit revealed callers like `ThreadSettingsModal` and `SpaceSettingsModal` that pass `errorMessage` when `error` is false, which would break with a condition change. Fully reverted.

### 3. `overflow: hidden` on `.onboarding-input-wrapper`
Does not work because `fit-content` resolves the wrapper's width before overflow is evaluated. The wrapper *chooses* to be wider; overflow only clips content that exceeds a resolved width.

### 4. `width: 100%` on `.onboarding-input-wrapper`
Fixes the shift but makes both input fields too wide (fills the entire parent).

## Fix Applied

Added to `.onboarding-input-wrapper` in `_onboarding.scss`:

```scss
.input-error-message {
  width: 0;
  min-width: 100%;
}
```

This is a standard CSS pattern for preventing a child from influencing `fit-content` intrinsic sizing. Setting `width: 0` makes the error div's intrinsic width zero, so it does not contribute to the parent's `fit-content` calculation. Then `min-width: 100%` forces the error div to fill the container's resolved width (determined by the input element alone). The error text wraps within the input's width. Works on all screen sizes with no breakpoints.

### Files changed

- `src/styles/_onboarding.scss` -- added `width: 0; min-width: 100%` rule for `.input-error-message` inside `.onboarding-input-wrapper`

---
*Filed: 2026-04-14*
*Solved: 2026-04-14*
