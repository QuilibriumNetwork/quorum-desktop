---
type: task
title: UserProfile card layout polish pass
status: open
created: 2026-06-08
scope: desktop (UI design)
priority: medium
surfaced-by: 2026-06-08 per-space bio port — adding the "About" section exposed several layout issues the card already had
related:
  - .agents/tasks/port-from-mobile/2026-06-08-port-per-space-bio.md (the port that surfaced this)
  - .agents/tasks/2026-06-08-userprofile-positioning-floating-ui.md (positioning architecture refactor — orthogonal but adjacent)
---

# UserProfile card layout polish pass

## Why this exists

The per-space bio port (2026-06-08) added an "About" section to the in-channel `UserProfile` card. While verifying the feature, user observed that the card has multiple layout issues that pre-date the bio addition but became more visible once a new section was rendered alongside the existing sections. Deferred to a focused UI polish PR rather than bundled into the feature port.

## What "polish" means here

Not yet enumerated by the user — the call was "several issues with the layout" without specifics. When picking this up, **start by capturing screenshots of every UserProfile render state** so the problems are concrete before proposing fixes:

| State | How to reproduce |
|---|---|
| Other member, has roles + bio | Click another member's name in a space channel where they have a role and a per-space bio |
| Other member, no bio | Click a member who hasn't set a bio |
| Other member, no roles, no bio | Click a brand-new member |
| Own profile, in a space, no bio | Click your own name in a space where you haven't set a per-space bio |
| Own profile, in a space, with bio | Click your own name after setting a per-space bio |
| Sidebar click, top of viewport | Click the first member in the right-side users sidebar |
| Sidebar click, bottom of viewport | Click the last member in a long sidebar list |
| @mention click | Click an @mention inside a message |
| With personal note open | Click a member, click "Add a note", expand the note |
| With moderation buttons | View a member where you can mute/kick them |

That coverage will surface whether the issues are:
- **Spacing/padding** between sections (header → roles → bio → note → actions all use ad-hoc margins)
- **Header treatment** (`var(--surface-5)` background on a darker card body — visual hierarchy may need rethink with more content underneath)
- **Section dividers** (the current "borderTop on each section header" approach was designed for fewer sections)
- **Typography** (bio text + note text + role pills — font weight ladder is inconsistent)
- **Responsive behavior** (the card is `width: 330px` desktop, `width: 240px` below `$screen-xs` — bio may wrap awkwardly)
- **Empty states** (own profile with no roles + no bio + no note collapses to just the header)

## Relevant files

- `src/components/user/UserProfile.tsx` — the card component, all sections
- `src/components/user/UserProfile.scss` — all styling
- `src/components/user/UserAvatar.tsx` — the avatar component shown in the header (potentially also needs touch-up if avatar size feels off relative to the card width)

## Known pre-existing issues (background context, not necessarily in scope)

These were noticed during the bio port but predate it:

1. **The header keeps `var(--surface-5)` even on dark themes** — looks lighter than the body. May be intentional contrast, may be drift. Verify with the design intent.
2. **Card has no max-height** — extremely long bios + many roles + open note could grow past viewport even with the positioning clamp we landed in the bio PR. A `max-height: calc(100vh - 32px); overflow-y: auto` on `.user-profile` would handle this.
3. **Sections share visual treatment with their dividers** (`border-top` on first child gets stripped via `:first-child`). Adding/removing sections rearranges which one inherits the top edge. Likely cleaner with explicit dividers between sections rather than per-section borders.
4. **No animation on open/close** — the card just appears. A modest fade/scale (~120ms) would feel more polished and would help when the card flips position via the upward-direction logic.

## What's NOT in scope

- The positioning architecture refactor (Floating UI). That's tracked separately at [`2026-06-08-userprofile-positioning-floating-ui.md`](2026-06-08-userprofile-positioning-floating-ui.md). They could be done in the same PR if it makes sense once both are scoped, but they're independent.
- Any changes to the data the card displays (bio resolution rules, role visibility logic, etc.) — settled in the bio port.
- Mobile drawer rendering — `MobileDrawer` is a separate component, not `UserProfile`.

## Suggested approach

1. Reproduce each row in the "states" table above, screenshot each.
2. Sit with the user to walk through the screenshots and capture the specific complaints (the original feedback was "several issues" without specifics — get them concrete before designing fixes).
3. Draft a focused design proposal: which sections, what spacing tokens, what header treatment.
4. Implement in a single PR; verify against the same screenshot set.

---

*Created 2026-06-08 during the per-space bio port. User: "I think there are several issues with the layout of the user profile model, but I prefer to tackle this in a different PR."*
