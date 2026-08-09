import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import SyncStatusLine from '@/components/modals/UserSettingsModal/SyncStatusLine';
import type { LastPublish } from '@quilibrium/quorum-shared';

const PUBLISH_KEY = 'quorum:sync:lastPublish';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

/**
 * Failures-only. Silence means sync is fine, so "renders nothing" is a real
 * assertion here rather than an absence of one: a line appearing when nothing
 * is wrong is the regression this component was rewritten to remove.
 */
describe('SyncStatusLine', () => {
  beforeEach(() => {
    localStorage.removeItem(PUBLISH_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const store = (record: Partial<LastPublish>) =>
    localStorage.setItem(
      PUBLISH_KEY,
      JSON.stringify({ at: Date.now(), outcome: 'published', ...record })
    );

  describe('stays silent when nothing is wrong', () => {
    it('after a successful publish', () => {
      // The whole point of the rewrite. "Last synced 3 days ago" on a healthy
      // device is indistinguishable from three days broken.
      store({ outcome: 'published' });
      const { container } = render(<SyncStatusLine allowSync={true} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('when nothing has ever been recorded', () => {
      const { container } = render(<SyncStatusLine allowSync={true} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('when the recorded outcome is "off"', () => {
      store({ outcome: 'off' });
      const { container } = render(<SyncStatusLine allowSync={true} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('when sync is off, even with a failure on record', () => {
      // The failure predates the switch, and the toggle above already says
      // everything there is to say.
      store({ outcome: 'rejected' });
      const { container } = render(<SyncStatusLine allowSync={false} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('when the record is corrupted', () => {
      localStorage.setItem(PUBLISH_KEY, '{ not json');
      const { container } = render(<SyncStatusLine allowSync={true} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('when a newer build wrote an outcome this one does not know', () => {
      store({ outcome: 'some-future-state' as never });
      const { container } = render(<SyncStatusLine allowSync={true} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('speaks up when publishing is failing', () => {
    it('explains a hold without implying anything is broken', () => {
      store({ outcome: 'held', spacesPublished: 2, spacesHeld: 1 });
      render(<SyncStatusLine allowSync={true} />);
      expect(screen.getByText(/waiting for spaces to finish syncing/i)).toBeInTheDocument();
    });

    it('says a refused sync kept the change on this device', () => {
      // The reassurance is load-bearing. Without it the message reads as "your
      // change is gone", which is exactly what is NOT true after the fix.
      store({ outcome: 'rejected', detail: 'invalid config missing data' });
      render(<SyncStatusLine allowSync={true} />);
      expect(screen.getByText(/the server refused your settings/i)).toBeInTheDocument();
      expect(screen.getByText(/saved on this device/i)).toBeInTheDocument();
    });

    it('says a timeout will keep retrying', () => {
      store({ outcome: 'timeout' });
      render(<SyncStatusLine allowSync={true} />);
      expect(screen.getByText(/timed out/i)).toBeInTheDocument();
      expect(screen.getByText(/keep retrying/i)).toBeInTheDocument();
    });

    it('reports a missing key', () => {
      store({ outcome: 'no-keys' });
      render(<SyncStatusLine allowSync={true} />);
      expect(screen.getByText(/no key is available/i)).toBeInTheDocument();
    });

    it('announces the failure to screen readers', () => {
      store({ outcome: 'rejected' });
      render(<SyncStatusLine allowSync={true} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('tracks changes while the panel is open', () => {
    it('appears when a publish starts failing', () => {
      vi.useFakeTimers();
      store({ outcome: 'published' });
      const { container } = render(<SyncStatusLine allowSync={true} />);
      expect(container).toBeEmptyDOMElement();

      store({ outcome: 'rejected' });
      act(() => {
        vi.advanceTimersByTime(2500);
      });

      expect(screen.getByText(/the server refused your settings/i)).toBeInTheDocument();
    });

    it('clears itself once a publish succeeds again', () => {
      // The direction that is easy to forget. A warning that never goes away is
      // worse than none, because it stops meaning anything.
      vi.useFakeTimers();
      store({ outcome: 'rejected' });
      const { container } = render(<SyncStatusLine allowSync={true} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();

      store({ outcome: 'published' });
      act(() => {
        vi.advanceTimersByTime(2500);
      });

      expect(container).toBeEmptyDOMElement();
    });
  });
});
