import React from 'react';
import { DevNavMenu } from '../DevNavMenu';

/**
 * Named width tiers. Pages pick one of these rather than inventing a
 * `max-w-*`, which is how eleven pages ended up on six different widths.
 *
 * The tiers exist because the needs are genuinely different — a dense data
 * table and a three-field form should not share a width. What matters is that
 * the choice is named.
 */
export type DevPageWidth = 'narrow' | 'standard' | 'wide' | 'full';

const WIDTH_CLASS: Record<DevPageWidth, string> = {
  /** Reading and forms. */
  narrow: 'max-w-3xl',
  /** Most tools. */
  standard: 'max-w-5xl',
  /** Document browsers. */
  wide: 'max-w-7xl',
  /** Dense tables that genuinely need the room. */
  full: 'max-w-screen-2xl',
};

interface DevPageProps {
  width?: DevPageWidth;
  /** Extra classes on the content column, not the outer frame. */
  className?: string;
  children: React.ReactNode;
}

/**
 * The frame every dev tool sits in: app background, the nav, and a
 * width-constrained content column.
 *
 * The nav is always sticky. It used to be sticky on four pages out of eleven
 * with no rationale, and on the long pages (Audit, Issues) being able to switch
 * tools without scrolling back to the top is strictly better.
 *
 * Note that no page passes the nav its current path — `DevNavMenu` reads the
 * live route itself. That is deliberate: the one page that forgot to pass it
 * was the one page that never highlighted itself.
 */
export const DevPage: React.FC<DevPageProps> = ({
  width = 'standard',
  className = '',
  children,
}) => (
  <div className="min-h-screen bg-app">
    <DevNavMenu sticky />
    <div className={`p-6 mx-auto ${WIDTH_CLASS[width]} ${className}`}>
      {children}
    </div>
  </div>
);
