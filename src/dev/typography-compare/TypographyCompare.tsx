/**
 * Typography Compare — see the colour bug, and each candidate fix, side by side.
 *
 * Built for the review of
 * `.agents/issues/.open/2026-08-12-typography-classes-have-no-working-colour.md`,
 * where the question "what will this actually look like afterwards?" could not
 * be answered from hex values on their own.
 *
 * **This is not a mockup.** Every sample below uses the real semantic classes
 * from `src/styles/_typography.scss` and the real theme variables from
 * `src/styles/_colors.scss`, rendered through the app's own bundle. The
 * left-hand column has no overrides at all, so it is literally what the app
 * renders today, bug and all. The other two columns add exactly the declaration
 * each candidate fix would add, and nothing else.
 *
 * Delete this page once the fix has shipped and been signed off — it documents a
 * decision, not a feature.
 */

import React from 'react';
import { Icon } from '../../components/primitives';
import { DevPage, DevPageHeader } from '../shell';

// The real message-edit rules live here and are normally only loaded with the
// message list. Imported directly so `.message-edit-container` is genuine.
import '../../components/message/Message.scss';

/**
 * The candidate fixes, expressed as scoped CSS.
 *
 * `.tc-now` deliberately has no rules — the point of that column is the absence.
 *
 * `:not(.tc-pinned)` exists because a handful of real call sites already pair
 * the class with a Tailwind colour utility. Those sites do not change when the
 * bug is fixed (Tailwind utilities load after `_typography.scss`, so they win on
 * equal specificity), and the pinned sample below demonstrates that.
 */
const VARIANT_CSS = `
/* --- Candidate 1: make the four rules valid, change nothing else --- */
.tc-fixed .text-title-large:not(.tc-pinned) { color: var(--color-text-strong); }
.tc-fixed .text-label:not(.tc-pinned),
.tc-fixed .text-small:not(.tc-pinned),
.tc-fixed .text-small-desktop:not(.tc-pinned) { color: var(--color-text-subtle); }
.tc-fixed .message-edit-container {
  background-color: var(--surface-2);
  border: 1px solid var(--surface-4);
}

/* --- Candidate 2: the same, plus a darker light-theme subtle for WCAG AA --- */
.tc-fixed-aa .text-title-large:not(.tc-pinned) { color: var(--color-text-strong); }
.tc-fixed-aa .text-label:not(.tc-pinned),
.tc-fixed-aa .text-small:not(.tc-pinned),
.tc-fixed-aa .text-small-desktop:not(.tc-pinned) { color: #696969; }
html.dark .tc-fixed-aa .text-label:not(.tc-pinned),
html.dark .tc-fixed-aa .text-small:not(.tc-pinned),
html.dark .tc-fixed-aa .text-small-desktop:not(.tc-pinned) {
  color: var(--color-text-subtle);
}
.tc-fixed-aa .message-edit-container {
  background-color: var(--surface-2);
  border: 1px solid var(--surface-4);
}
`;

// --- contrast measurement -------------------------------------------------

const srgbToLinear = (c: number) =>
  c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const parseRgb = (value: string): [number, number, number] | null => {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  return [parts[0], parts[1], parts[2]];
};

const luminance = ([r, g, b]: [number, number, number]) => {
  const [lr, lg, lb] = [r, g, b].map(v => srgbToLinear(v / 255));
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

/** Walks up for the first non-transparent background, as the eye would see it. */
const effectiveBackground = (el: Element): [number, number, number] => {
  let node: Element | null = el;
  while (node) {
    const bg = parseRgb(getComputedStyle(node).backgroundColor);
    const alpha = getComputedStyle(node).backgroundColor.match(
      /rgba\([^)]+,\s*([\d.]+)\)/
    );
    if (bg && (!alpha || Number(alpha[1]) > 0)) return bg;
    node = node.parentElement;
  }
  return [255, 255, 255];
};

const contrastOf = (el: Element): number | null => {
  const fg = parseRgb(getComputedStyle(el).color);
  if (!fg) return null;
  const bg = effectiveBackground(el);
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Reads the rendered colour and contrast straight off the DOM.
 *
 * Measured rather than declared on purpose: a hardcoded label would still read
 * "correct" if the CSS above stopped applying, which is exactly the failure
 * mode this whole page exists to expose.
 */
const Readout: React.FC<{ targetRef: React.RefObject<HTMLElement | null> }> = ({
  targetRef,
}) => {
  const [state, setState] = React.useState<{
    color: string;
    ratio: number | null;
  } | null>(null);

  React.useEffect(() => {
    const measure = () => {
      const el = targetRef.current;
      if (!el) return;
      setState({
        color: getComputedStyle(el).color,
        ratio: contrastOf(el),
      });
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [targetRef]);

  if (!state) return null;
  const { color, ratio } = state;
  const passes = ratio !== null && ratio >= 4.5;

  return (
    <div className="mt-3 border-t border-subtle pt-3">
      <p className="text-small-desktop tc-pinned text-subtle font-mono">
        {color}
      </p>
      <p
        className={`text-small-desktop tc-pinned font-mono ${
          passes ? 'text-success' : 'text-danger'
        }`}
      >
        {ratio === null ? '—' : `${ratio.toFixed(2)}:1`}{' '}
        {passes ? 'passes AA' : 'fails AA (needs 4.5)'}
      </p>
    </div>
  );
};

// --- the sample UI --------------------------------------------------------

/**
 * A realistic slice of the app, not a swatch chart.
 *
 * The markup mirrors what a settings pane actually renders: a section header,
 * help text under it, a control row with its own label, and a metadata line.
 * Those are the shapes `.text-label` and `.text-small` are used in across the
 * 78 affected call sites, so this is where the change will be felt.
 */
const Sample: React.FC<{
  variant: string;
  title: string;
  note: string;
}> = ({ variant, title, note }) => {
  const labelRef = React.useRef<HTMLParagraphElement>(null);

  return (
    <div className={`flex-1 min-w-72 ${variant}`}>
      <div className="mb-3">
        <p className="text-strong font-bold">{title}</p>
        <p className="text-subtle text-sm">{note}</p>
      </div>

      <div className="rounded-lg border border-subtle bg-modal p-5">
        {/* Dialog title — .text-title-large */}
        <p className="text-title-large mb-1">Privacy &amp; Security</p>
        <p className="text-body mb-6">
          Manage devices and privacy conditions for this account.
        </p>

        {/* Section header + help text — .text-subtitle-2 / .text-label */}
        <p className="text-subtitle-2 mb-2">Devices</p>
        <p ref={labelRef} className="text-label mb-5">
          Devices you have linked can read your messages. Removing a device
          revokes its keys immediately.
        </p>

        {/* Control row — .text-label-strong (works today) vs .text-label */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-label-strong">Require approval for new devices</p>
            <p className="text-label">
              You will be asked to confirm before a device is linked.
            </p>
          </div>
          <Icon name="settings" size="md" className="text-subtle shrink-0" />
        </div>

        {/* Metadata — .text-small */}
        <p className="text-small mb-5">Last verified 3 days ago</p>

        {/* A site that already pins a Tailwind colour — unchanged by the fix */}
        <p className="text-label tc-pinned text-subtle mb-5">
          This line already pairs the class with a Tailwind colour, so the fix
          does not move it.
        </p>

        {/* The Message.scss half — real class, real rules */}
        <p className="text-subtitle-2 mb-2">Message edit box</p>
        <div className="message-edit-container">
          <p className="text-body">Editing a message looks like this.</p>
        </div>
      </div>

      <Readout targetRef={labelRef} />
    </div>
  );
};

export const TypographyCompare: React.FC = () => {
  const [dark, setDark] = React.useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setDark(document.documentElement.classList.contains('dark'));
  };

  return (
    <DevPage>
      <style>{VARIANT_CSS}</style>

      <DevPageHeader
        icon="heading"
        title="Typography Compare"
        subtitle="What the colour fix will actually change, in the real stylesheet"
        actions={
          <button
            type="button"
            onClick={toggleTheme}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-subtle bg-surface-2 px-3 py-2"
          >
            <Icon name={dark ? 'sun' : 'moon'} size="md" />
            <span className="text-label-strong">
              {dark ? 'Light theme' : 'Dark theme'}
            </span>
          </button>
        }
      />

      <div className="mb-6 rounded-lg border border-subtle bg-surface-2 p-4">
        <p className="text-body mb-2">
          Four rules in <code>_typography.scss</code> wrap a hex colour in{' '}
          <code>rgb()</code>, which is invalid, so the browser drops the whole
          declaration and the text inherits its parent&apos;s colour instead.
        </p>
        <p className="text-label">
          The left column has no overrides — it is what the app renders today.
          The other two add exactly the declaration each fix would add. Toggle
          the theme; the light theme is where the decision actually sits.
        </p>
      </div>

      <div className="flex flex-wrap gap-6">
        <Sample
          variant="tc-now"
          title="Now"
          note="Colour dropped, text inherits body colour"
        />
        <Sample
          variant="tc-fixed"
          title="Fix only"
          note="Uses the design token as authored"
        />
        <Sample
          variant="tc-fixed-aa"
          title="Fix + AA contrast"
          note="Light-theme subtle darkened to #696969"
        />
      </div>
    </DevPage>
  );
};
