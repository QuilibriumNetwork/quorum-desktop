# Bug: Tabler Icon Overlapping Stroke Artifact in Dropzone Circles

[← Back to INDEX](/.agents/INDEX.md)

## Status
Archived — not a bug, known SVG rendering limitation. No fix applied, deferred indefinitely.

## Description
When a Tabler outline icon (e.g. `image`) is rendered inside the `.avatar-upload.empty` dropzone circle, the icon strokes show a visible artifact: the outline appears to be composed of many semi-transparent segments, and where path segments intersect or overlap, they compound in opacity and appear noticeably darker.

## Root Cause (confirmed)
This is **specified SVG compositing behavior, not a bug**. SVG renders each `<path>` element independently using Porter-Duff "source-over". At stroke intersections, two semi-transparent stroke layers stack and compound -- producing darker blotches at joins. It is invisible on fully opaque backgrounds (which is why most apps never notice it). It only appears when the icon renders over a transparent, semi-transparent, gradient, or blurred backdrop.

Confirmed upstream issues in the icon libraries themselves:
- tabler/tabler-icons#112
- lucide-icons/lucide#2136

## Affected Surfaces
- Onboarding "Personalize your account" photo circle (confirmed visible -- dark gradient background)
- Potentially `.avatar-upload.empty` circles in modals -- but only if the background behind the circle is non-opaque

## Why CSS Fixes Don't Work
The SVG rendering model is separate from the CSS painting model. CSS compositing properties cannot reach inside it:

- **`isolation: isolate`** -- operates at the CSS stacking context level, does not affect intra-SVG path compositing
- **`paint-order: stroke fill`** -- controls fill/stroke order on a single element's own paint; no effect on separate `<path>` elements compositing against each other
- **`mix-blend-mode`** -- changes how the final SVG composites against elements behind it; does not affect intra-SVG path compositing
- **`overflow: hidden`** -- unrelated
- **`svg { fill: <bg-color> }`** -- correct in theory (fills path interiors to mask overlapping strokes), but fragile: requires knowing the exact background color in every context

## What Actually Works (not applied)

### Option A: CSS `mask-image` on a wrapper
Use the SVG as a stencil mask applied to a solid `div`. One rectangle composited through the mask -- no path intersections possible.

```css
.icon-wrapper {
  display: inline-block;
  width: 24px;
  height: 24px;
  background-color: currentColor;
  -webkit-mask-image: url("icon.svg");
  mask-image: url("icon.svg");
  mask-repeat: no-repeat;
  mask-size: contain;
}
```

Challenge: requires the SVG as a URL/data URI, awkward with React icon components.

### Option B: SVG `<mask>` element inline
Wrap all paths in a `<mask>` (white on black), render a single `<rect>` through it. All strokes merge in the mask buffer before compositing -- no doubles. Known Safari zoom quality degradation caveat.

### Option C: Solid background on the container
Simplest if the context allows -- give the container an opaque `background-color`. The doubled strokes become invisible. Fails when background is transparent, gradient, or unknown.

## Why Deferred
The artifact is only visible on non-opaque backgrounds and is subtle in most modal contexts. The available fixes either change the visual style (filled variant), require awkward SVG plumbing (mask-image), or are too fragile (background color matching). Not worth the complexity for now.

---
*Created: 2026-04-09 | Archived: 2026-04-09*
