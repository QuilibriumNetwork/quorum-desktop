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
 * The line under the sync toggle is the only place a user ever learns that sync
 * is failing. Every branch is asserted, including the two that only exist
 * because the toggle and the record can disagree.
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

  it('says changes stay on this device when sync is off', () => {
    render(<SyncStatusLine allowSync={false} />);
    expect(screen.getByText(/stay on this device/i)).toBeInTheDocument();
  });

  it('trusts the toggle over a stale record when sync was just switched off', () => {
    // The record still says the last save published. The switch is off NOW, so
    // "Last synced 2 minutes ago" would contradict what the user just did.
    store({ outcome: 'published' });
    render(<SyncStatusLine allowSync={false} />);
    expect(screen.getByText(/stay on this device/i)).toBeInTheDocument();
    expect(screen.queryByText(/last synced/i)).not.toBeInTheDocument();
  });

  it('says not synced yet when nothing has been recorded', () => {
    render(<SyncStatusLine allowSync={true} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });

  it('says not synced yet when sync is on but the last record predates it', () => {
    // The mirror of the stale-record case: switched ON, but no save has run
    // since, so the only record says 'off'. Claiming a sync would be a lie.
    store({ outcome: 'off' });
    render(<SyncStatusLine allowSync={true} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });

  it('reports a successful publish with a relative time', () => {
    store({ outcome: 'published', at: Date.now() - 3 * 60 * 1000 });
    render(<SyncStatusLine allowSync={true} />);
    expect(screen.getByText(/last synced 3 minutes ago/i)).toBeInTheDocument();
  });

  it('explains a hold without implying anything is broken', () => {
    store({ outcome: 'held', spacesPublished: 2, spacesHeld: 1 });
    render(<SyncStatusLine allowSync={true} />);
    expect(screen.getByText(/waiting for spaces to finish syncing/i)).toBeInTheDocument();
  });

  it('says a rejected sync kept the change locally', () => {
    // The reassurance is the point: the edit IS saved on this device, and
    // without saying so the message reads as "your change is gone".
    store({ outcome: 'rejected', detail: 'invalid config missing data' });
    render(<SyncStatusLine allowSync={true} />);
    expect(screen.getByText(/refused by the server/i)).toBeInTheDocument();
    expect(screen.getByText(/saved on this device/i)).toBeInTheDocument();
  });

  it('says a timeout will retry', () => {
    store({ outcome: 'timeout' });
    render(<SyncStatusLine allowSync={true} />);
    expect(screen.getByText(/timed out/i)).toBeInTheDocument();
    expect(screen.getByText(/will retry/i)).toBeInTheDocument();
  });

  it('reports a missing key', () => {
    store({ outcome: 'no-keys' });
    render(<SyncStatusLine allowSync={true} />);
    expect(screen.getByText(/no key available/i)).toBeInTheDocument();
  });

  it('announces failures to screen readers, and successes quietly', () => {
    store({ outcome: 'rejected' });
    const { unmount } = render(<SyncStatusLine allowSync={true} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    unmount();

    store({ outcome: 'published' });
    render(<SyncStatusLine allowSync={true} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('survives a corrupted record instead of taking the panel down', () => {
    localStorage.setItem(PUBLISH_KEY, '{ not json');
    render(<SyncStatusLine allowSync={true} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });

  it('picks up a publish that happens while the panel is open', async () => {
    // localStorage fires no event for same-tab writes, so without the poll the
    // line would sit on "Not synced yet" through a save the user just triggered.
    vi.useFakeTimers();
    render(<SyncStatusLine allowSync={true} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();

    store({ outcome: 'published', at: Date.now() });
    // The interval's setState lands outside React's auto-act window, so without
    // this the re-render never commits and the assertion reads the stale DOM.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.getByText(/last synced/i)).toBeInTheDocument();
  });
});
