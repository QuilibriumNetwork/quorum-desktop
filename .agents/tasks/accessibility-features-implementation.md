---
type: task
title: Accessibility Features — Remaining Work
status: open
complexity: high
ai_generated: true
created: 2026-01-06T00:00:00.000Z
updated: '2026-02-10'
related_tasks:
  - done/accessibility-wcag-remediation.md
---

# Accessibility Features — Remaining Work

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Current State (as of 2026-02-10)

**Estimated accessibility score: ~75/100 (up from ~50/100)**

The core WCAG 2.1 AA remediation is complete (see [done/accessibility-wcag-remediation.md](done/accessibility-wcag-remediation.md) for full details). Summary of what shipped:

- **Button `<span>` → `<button>`** — 100+ instances now keyboard-accessible with native focus, Enter, Space
- **Modal accessibility** — `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, focus restoration, close button as `<button>`
- **ARIA attributes** — Navigation labels, toast live region, loading announcements, image alt text
- **Semantic landmarks** — `<main>`, `<header>`, `<nav>` with labels
- **Keyboard focus indicators** — Global `:focus-visible` outline (keyboard-only, not mouse)
- **Test coverage** — 45 component tests (30 Button, 15 Modal)

---

## Remaining Work

### Quick Wins (low effort, low risk)

- [ ] **Form error associations**
  - Add `aria-describedby` connecting error messages to their input fields
  - Done when: screen readers announce error context when input is focused

- [ ] **Emoji picker focus fix**
  - File: `src/styles/_emoji-picker.scss`
  - Remove `outline: none !important` that kills focus indicators
  - Replace with visible `:focus-visible` indicator

### Reduced Motion Support (medium effort)

- [ ] **Audit all CSS animations for `prefers-reduced-motion`**
  - Already supported in: `_context-menu.scss:86`, `MobileDrawer.scss:277`, `MessageActionsMenu.scss:72`
  - Key targets: `Message.scss` mention highlight (61s), message highlight (8s), `ModalContainer` open/close
  - Pattern: `@media (prefers-reduced-motion: reduce) { animation: none; transition-duration: 0.01ms; }`
  - Consider: Global mixin in `_variables.scss` for consistent application

- [ ] **Add manual reduced motion toggle in settings**
  - Location: User Settings → Accessibility tab
  - Reference: Discord's implementation

### Color Contrast (design decision needed)

Current muted text (`--color-text-muted`) and disabled button colors are below WCAG AA 4.5:1 ratio but were kept per design review — they're intentional design choices. Options:

- [ ] **Revisit with adjusted values** that satisfy both design and AA requirements
- [ ] **Accept as-is** — document as known deviation

### Nice-to-Have Features (significant effort)

These are enhancement features inspired by Discord's accessibility settings:

#### High Contrast Theme
- Create high-contrast color palette (7:1+ ratio, stronger borders, no transparency)
- Add "High Contrast" toggle to theme settings (works independently from dark/light)
- Respond to `prefers-contrast: high` media query
- **Sources**: [WebAIM Contrast Guidelines](https://webaim.org/articles/contrast/), [Section 508 Typography](https://www.section508.gov/develop/fonts-typography/)

#### Dyslexia-Friendly Font
- Add OpenDyslexic font (SIL-OFL license, free)
- Font family toggle in Accessibility settings: "Default" / "OpenDyslexic"
- Apply via CSS variable `--font-family-main`
- **Sources**: [OpenDyslexic.org](https://opendyslexic.org/), [British Dyslexia Association](https://www.helperbird.com/blog/research-into-web-accessibility-for-dyslexics-and-dyslexia-focused-fonts-such-as-opendyslexia/)

#### Text Scaling
- Font size slider in Accessibility settings (Small/Medium/Large/Extra Large)
- Audit all font sizes to use rem units
- Ensure layouts handle 200% browser zoom
- Reference: Discord's "Chat Font Scaling" feature

#### Accessibility Settings Panel
- Required to house toggles for: reduced motion, high contrast, font choice, text scaling
- Location: User Settings modal
- Reference: [Discord Accessibility Settings](https://support.discord.com/hc/en-us/articles/1500010454681-Accessibility-Settings-Tab)

---

## Edge Cases

| Scenario | Expected Behavior | Status |
|----------|-------------------|--------|
| Custom emoji in messages | Alt text shows emoji name | Needs handling |
| Code blocks in high contrast | Maintain readability | Needs handling (if high contrast implemented) |
| Dynamic content (new messages) | Announce via aria-live region | Needs handling |

---

## Resources

**Testing Tools:**
- [axe DevTools](https://www.deque.com/axe/) — Automated accessibility testing
- [WAVE](https://wave.webaim.org/) — Web accessibility evaluation
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- NVDA (Windows) / VoiceOver (Mac) — Screen readers

**Guidelines:**
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [WAI-ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)

**Fonts:**
- [OpenDyslexic Download](https://opendyslexic.org/)
- [Lexend Font](https://www.lexend.com/)

---

## Updates

**2026-01-06**: Initial task creation with research on high contrast themes, dyslexia-friendly fonts, Discord/Telegram accessibility features, and WCAG 2.2 requirements.

**2026-02-10**: Core WCAG remediation completed and moved to `done/accessibility-wcag-remediation.md`. Restructured this task as the ongoing tracker for remaining accessibility work. Score improved from ~50/100 to ~75/100.
