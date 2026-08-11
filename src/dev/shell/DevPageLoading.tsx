import React from 'react';
import { Icon } from '../../components/primitives';
import { DevNavMenu } from '../DevNavMenu';

interface DevPageLoadingProps {
  /** Shown under the spinner, e.g. "Loading DB Inspector". */
  name: string;
}

/**
 * Suspense fallback for the lazily-loaded dev pages.
 *
 * These fallbacks used to be an unstyled `<div>Loading …</div>` that nobody
 * ever saw: the nav navigated with `<a href>`, so the browser tore down the
 * document before React could render anything. Now that the dev nav routes
 * client-side, this is the only thing on screen while the page's lazy chunk
 * arrives, so it renders the nav bar too — the chrome stays put and only the
 * content area swaps.
 */
export const DevPageLoading: React.FC<DevPageLoadingProps> = ({ name }) => (
  <div className="min-h-screen bg-app">
    <DevNavMenu sticky />
    <div
      className="flex flex-col items-center justify-center gap-3 py-24"
      role="status"
      aria-live="polite"
    >
      <Icon name="spinner" size="3xl" className="text-accent animate-spin" />
      <span className="text-label">Loading {name}</span>
    </div>
  </div>
);
