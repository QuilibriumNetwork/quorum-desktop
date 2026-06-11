import * as React from 'react';

/**
 * QuorumLoader — loading spinner for the Quorum messaging app.
 *
 * Dependency-free (just React). Inline SVG (the real brand vectors) animated
 * with CSS transforms/opacity only — GPU-composited, no layout/paint, no JS
 * running per frame. No image assets.
 *
 * Sizing: 144px on desktop, 96px below 480px viewport. Override per-instance
 * with the `size` prop. The word scales with the logo (≈ same width).
 *
 * Theming: every color is a CSS variable that defaults to the app's brand
 * tokens. The ring/arrow use the accent color (--accent) and the label uses
 * the subtle text color (--color-text-subtle). Override on an ancestor or via
 * the `style` prop:
 *   --ql-ring   ring color   (default var(--accent))
 *   --ql-arrow  arrow color  (default var(--accent))
 *   --ql-label  label text   (default var(--color-text-subtle))
 *
 * Usage:
 *   <QuorumLoader />                       // 144px, letters bounce on impact
 *   <QuorumLoader variant="dots" />        // only the dots jump
 *   <QuorumLoader size={120} text="Loading" />
 */

const RING_D =
  'M249.101 97C164.093 97 95 166.143 95 251C95 335.857 164.188 405 249.101 405C276.167 405 301.422 397.857 323.531 385.571L326.962 383.762L285.506 357.286C274.07 361.19 261.872 363.476 249.101 363.476C232.71 363.476 217.271 359.952 203.166 353.667C200.784 352.619 198.401 351.476 196.114 350.238C193.636 348.905 191.254 347.476 188.967 345.952C177.816 338.905 168 329.952 159.995 319.476C154.849 312.81 150.37 305.476 146.844 297.762C145.7 295.19 144.747 292.524 143.699 289.952C140.458 281.381 138.267 272.333 137.218 262.905C136.742 259 136.456 255.095 136.456 251C136.456 246.905 136.742 242.81 137.123 238.81C142.65 187.667 182.677 146.81 233.377 139.762C238.523 139 243.765 138.524 249.006 138.524C251.96 138.524 254.82 138.714 257.679 139C315.717 143.476 361.556 191.952 361.556 251.095C361.556 262.143 359.746 272.714 356.696 282.81L384.715 323.476C396.341 301.857 403.108 277.286 403.108 251.095C403.108 166.143 333.919 97.0953 249.006 97.0953L249.101 97Z';
const ARROW_D =
  'M263.872 264.817L179.722 262.817L392.243 398.246L401.868 388.341L258.821 180.817L263.872 264.817Z';

const CSS = `
.ql-root{
  --ql-size:144px;
  --ql-ring:var(--accent); --ql-arrow:var(--accent); --ql-label:var(--color-text-subtle);
  display:inline-flex; flex-direction:column; align-items:center;
  gap:calc(var(--ql-size) * 0.09);
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
@media (max-width:480px){ .ql-root{ --ql-size:96px; } }

.ql-spinner{ display:block; width:var(--ql-size); height:var(--ql-size); overflow:visible; }
.ql-ring{ fill:var(--ql-ring); }
.ql-arrow{ fill:var(--ql-arrow); }
.ql-ring,.ql-arrow{ transform-box:view-box; transform-origin:50% 50%; }
.ql-arrow{ animation:qlShoot 1.7s infinite; }
.ql-ring{ animation:qlRing 1.7s infinite; }

.ql-label{
  font-weight:500; font-size:calc(var(--ql-size) * 0.15); letter-spacing:.01em;
  color:var(--ql-label); white-space:nowrap;
}
.ql-jch{ display:inline-block; animation-duration:1.7s; animation-iteration-count:infinite; animation-fill-mode:both; }

@keyframes qlShoot{
  0%   { transform:translate(-58%,-58%) scale(.78); opacity:0; animation-timing-function:cubic-bezier(.5,0,.85,.4); }
  9%   { opacity:1; }
  40%  { transform:translate(9%,9%) scale(1.07); opacity:1; animation-timing-function:cubic-bezier(.3,.6,.4,1); }
  55%  { transform:translate(-4%,-4%) scale(.98); animation-timing-function:ease-in-out; }
  67%  { transform:translate(2.5%,2.5%) scale(1.01); animation-timing-function:ease-in-out; }
  78%  { transform:translate(0,0) scale(1); }
  90%  { transform:translate(0,0) scale(1); opacity:1; }
  100% { transform:translate(0,0) scale(1); opacity:0; }
}
@keyframes qlRing{
  0%,34% { transform:scale(1); }
  42%    { transform:scale(1.05); }
  52%    { transform:scale(.987); }
  62%    { transform:scale(1.007); }
  70%,100%{ transform:scale(1); }
}
/* glyph "jump personalities" (varied height & timing) — --amp scales the height */
@keyframes qlA{
  0%,40%{transform:translateY(0);animation-timing-function:cubic-bezier(.2,.85,.3,1)}
  46%{transform:translateY(calc(-0.60em * var(--amp,1)));animation-timing-function:cubic-bezier(.4,0,.7,1)}
  55%{transform:translateY(calc(0.10em * var(--amp,1)));animation-timing-function:ease-out}
  64%{transform:translateY(calc(-0.13em * var(--amp,1)))}
  73%{transform:translateY(calc(0.03em * var(--amp,1)))}
  82%,100%{transform:translateY(0)}
}
@keyframes qlB{
  0%,41%{transform:translateY(0);animation-timing-function:cubic-bezier(.25,.8,.35,1)}
  49%{transform:translateY(calc(-0.40em * var(--amp,1)));animation-timing-function:cubic-bezier(.4,0,.7,1)}
  59%{transform:translateY(calc(0.07em * var(--amp,1)));animation-timing-function:ease-out}
  68%{transform:translateY(calc(-0.09em * var(--amp,1)))}
  78%,100%{transform:translateY(0)}
}
@keyframes qlC{
  0%,39%{transform:translateY(0);animation-timing-function:cubic-bezier(.18,.9,.3,1)}
  44%{transform:translateY(calc(-0.82em * var(--amp,1)));animation-timing-function:cubic-bezier(.45,0,.7,1)}
  54%{transform:translateY(calc(0.15em * var(--amp,1)));animation-timing-function:ease-out}
  63%{transform:translateY(calc(-0.18em * var(--amp,1)))}
  72%{transform:translateY(calc(0.05em * var(--amp,1)))}
  81%,100%{transform:translateY(0)}
}
@keyframes qlD{
  0%,42%{transform:translateY(0);animation-timing-function:cubic-bezier(.22,.82,.33,1)}
  51%{transform:translateY(calc(-0.50em * var(--amp,1)));animation-timing-function:cubic-bezier(.42,0,.7,1)}
  61%{transform:translateY(calc(0.09em * var(--amp,1)));animation-timing-function:ease-out}
  71%{transform:translateY(calc(-0.11em * var(--amp,1)))}
  81%,100%{transform:translateY(0)}
}
@media (prefers-reduced-motion:reduce){
  .ql-arrow,.ql-ring{ animation:qlBreathe 2.8s ease-in-out infinite !important; }
  .ql-jch{ animation:none !important; }
}
@keyframes qlBreathe{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
`;

// inject the stylesheet once (no build step / CSS-in-JS dependency needed)
const STYLE_ID = 'quorum-loader-css';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

// scattered jump assignments → organic, non-uniform bounce
const NAMES = ['qlC', 'qlA', 'qlD', 'qlB', 'qlC', 'qlA', 'qlB', 'qlD', 'qlA', 'qlC', 'qlD', 'qlB', 'qlC'];
const DELAYS = [0, 0.03, -0.02, 0.05, 0.01, -0.03, 0.04, 0, -0.01, 0.02, 0.05, -0.02, 0.03];

export interface QuorumLoaderProps {
  /** Word shown under the logo; bounces glyph-by-glyph (or only the dots in "dots" variant). */
  text?: string;
  /** "letters" = the whole word bounces on impact; "dots" = only the trailing dots jump. */
  variant?: 'letters' | 'dots';
  /** Optional size override, e.g. 120 or "10rem". Omit for the responsive default (144 / 96). */
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export default function QuorumLoader({
  text = 'Connecting',
  variant = 'letters',
  size,
  className = '',
  style,
}: QuorumLoaderProps) {
  const rootStyle: React.CSSProperties = {
    ...(size != null ? { '--ql-size': typeof size === 'number' ? size + 'px' : size } : {}),
    ...style,
  } as React.CSSProperties;

  let label: React.ReactNode;
  if (variant === 'dots') {
    label = (
      <div className="ql-label" aria-hidden="true">
        {text}
        <span className="ql-jch" style={{ animationName: 'qlC', animationDelay: '0s' }}>
          .
        </span>
        <span className="ql-jch" style={{ animationName: 'qlB', animationDelay: '.05s' }}>
          .
        </span>
        <span className="ql-jch" style={{ animationName: 'qlD', animationDelay: '-.03s' }}>
          .
        </span>
      </div>
    );
  } else {
    const chars = (text + '...').split('');
    label = (
      <div className="ql-label" aria-hidden="true" style={{ '--amp': 0.5 } as React.CSSProperties}>
        {chars.map((ch, i) => (
          <span
            key={i}
            className="ql-jch"
            style={{
              animationName: NAMES[i % NAMES.length],
              animationDelay: DELAYS[i % DELAYS.length] + 's',
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={('ql-root ' + className).trim()} style={rootStyle} role="status" aria-label={text + '…'}>
      <svg className="ql-spinner" viewBox="0 0 500 500" aria-hidden="true">
        <path className="ql-ring" d={RING_D} />
        <path className="ql-arrow" d={ARROW_D} />
      </svg>
      {label}
    </div>
  );
}
