import React from 'react';
import { DevNavMenu } from '../DevNavMenu';

/**
 * The frame every dev tool sits in: app background, the nav, and one content
 * column.
 *
 * **One width for every page, deliberately.** An earlier version had four named
 * tiers (narrow/standard/wide/full) on the theory that a dense table and a
 * three-field form want different widths. In practice that just reproduced the
 * inconsistency it replaced, in a tidier form — clicking through the nav still
 * made the content jump around. A single width is simpler to reason about, and
 * on a developer surface the uniformity is worth more than a per-page optimum.
 *
 * The nav is always sticky. It used to be sticky on four pages out of eleven
 * with no rationale, and on the long pages (Audit, Issues) being able to switch
 * tools without scrolling back to the top is strictly better.
 *
 * Note that no page passes the nav its current path — `DevNavMenu` reads the
 * live route itself. That is deliberate: the one page that forgot to pass it
 * was the one page that never highlighted itself.
 */
interface DevPageProps {
  /** Extra classes on the content column, not the outer frame. */
  className?: string;
  children: React.ReactNode;
}

export const DevPage: React.FC<DevPageProps> = ({
  className = '',
  children,
}) => (
  <div className="min-h-screen bg-app">
    <DevNavMenu sticky />
    <div className={`p-6 mx-auto max-w-7xl ${className}`}>{children}</div>
  </div>
);
