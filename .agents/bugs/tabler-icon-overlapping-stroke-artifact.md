# Bug: Tabler Icon Overlapping Stroke Artifact in Dropzone Circles

## Status
Open

## Description
When a Tabler outline icon (e.g. `image`) is rendered inside the `.avatar-upload.empty` dropzone circle, the icon strokes show a visible artifact: the outline appears to be composed of many semi-transparent segments, and where path segments intersect or overlap, they compound in opacity and appear noticeably darker. The result looks like the icon is made of translucent strokes that become more opaque at their joins/intersections.

## Affected Surfaces
- Onboarding "Personalize your account" photo circle (confirmed visible)
- Likely all `.avatar-upload.empty` circles (Space Settings icon, User Settings avatar, Create Space icon) — same root cause

## Root Cause (suspected)
Tabler outline icons use multiple `<path>` elements with `fill="none"`, `stroke="currentColor"`, `strokeLinecap="round"`, and `strokeLinejoin="round"`. Where paths cross or share endpoints (e.g. the rectangular frame and the mountain/landscape lines in `IconPhoto`), the stroked regions overlap. On a transparent or semi-transparent background, these overlapping strokes compound their opacity, producing darker blotches at intersections — the "segmented semi-transparent outline" artifact.

This is a compositing issue specific to SVG stroke rendering on non-opaque backgrounds.

## What Was Tried (did not work / made it worse)
- `overflow: hidden` + `isolation: isolate` on the container — no effect on the artifact, caused other visual issues
- `background-color: var(--surface-0)` on the container — partially helps in modals but doesn't fully eliminate it; broke onboarding appearance
- `svg { fill: var(--surface-0) }` — overrides Tabler's `fill="none"`, fills path interiors with background color to "erase" overlapping strokes. Correct approach in theory but hard to match the exact background color in all contexts (especially transparent/gradient backgrounds like onboarding)
- Hardcoded `svg { fill: #1a5fa8 }` for onboarding — fragile, color-dependent, not a real fix

## Likely Fix Direction
User recalls fixing an identical issue in another repo (possibly `qns`). The fix was reportedly simple once understood. Candidates to research:
- CSS `paint-order: stroke fill` on the SVG — may change how strokes and fills composite
- Rendering the icon at a larger size and scaling down with CSS
- Using the **filled** variant of the Tabler icon instead of outline (avoids multi-path stroke compounding entirely)
- A specific CSS property that forces opaque compositing on SVG paths without needing to know the background color

## Notes
- The `Icon` primitive is in `quorum-shared`, rendering via `@tabler/icons-react` v3.40.0
- The artifact is visible on any non-opaque background; in normal light-theme modals it may be subtle enough to go unnoticed
- The fix should ideally be applied either in the `Icon` primitive (quorum-shared) or via a targeted CSS rule on `.avatar-upload.empty svg`

---
*Created: 2026-04-09*
