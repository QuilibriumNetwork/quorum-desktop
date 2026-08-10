import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { FloatingPopover, rectAnchor } from '../../../components/ui/FloatingPopover';
import EmojiPicker from '../../../components/emoji-picker/EmojiPicker';

/**
 * `closeOnScroll` exists for surfaces anchored inside the virtualized message
 * list: their anchor moves by CSS transform, which JS positioning cannot track
 * in lockstep, so the surface closes rather than lag behind.
 *
 * It is implemented as a CAPTURE-phase scroll listener on `window`. Scroll
 * events do not bubble, but capture still walks window → document → target, so
 * that one listener sees scrolls from every scroller in the document —
 * including scrollers inside the popover's own content.
 *
 * The emoji picker is such a surface: its grid is a react-virtuoso scroller,
 * and its category buttons scroll it programmatically via scrollToIndex. Both
 * fired the window listener and dismissed the picker the moment the user tried
 * to use it. Scrolls originating inside the popover must be ignored.
 */

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');

  // floating-ui's autoUpdate observes size and layout shifts; jsdom ships
  // neither observer. Stub both locally so this suite does not perturb others.
  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??=
    NoopObserver as unknown as typeof IntersectionObserver;
});

function renderPopover(onClose: () => void) {
  // An outside scroller standing in for the message list behind the popover.
  const outside = document.createElement('div');
  outside.setAttribute('data-testid', 'outside-scroller');
  document.body.appendChild(outside);

  render(
    <FloatingPopover
      open
      onClose={onClose}
      // A virtual anchor keeps FloatingFocusManager out of the way; the scroll
      // behaviour under test is independent of the anchor kind.
      anchor={rectAnchor({ x: 10, y: 10, width: 20, height: 20 })}
      closeOnScroll
    >
      <div data-testid="popover-scroller">
        <div data-testid="popover-child">emoji grid</div>
      </div>
    </FloatingPopover>
  );

  return { outside };
}

const scroll = (el: EventTarget) =>
  el.dispatchEvent(new Event('scroll', { bubbles: false }));

describe('FloatingPopover — closeOnScroll', () => {
  it('stays open when the scroll came from inside the popover', () => {
    const onClose = vi.fn();
    renderPopover(onClose);

    scroll(screen.getByTestId('popover-scroller'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('stays open when a nested descendant scrolls', () => {
    const onClose = vi.fn();
    renderPopover(onClose);

    // react-virtuoso's scrollToIndex fires the event on its inner scroller,
    // which sits several levels below the popover root.
    scroll(screen.getByTestId('popover-child'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the scroll came from outside the popover', () => {
    const onClose = vi.fn();
    const { outside } = renderPopover(onClose);

    scroll(outside);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a document-level scroll', () => {
    const onClose = vi.fn();
    renderPopover(onClose);

    scroll(document);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('FloatingPopover — closeOnScroll with the real emoji picker', () => {
  // The reported bug, at the actual pairing: the reaction picker is an
  // EmojiPicker inside a closeOnScroll popover, and its grid is a react-virtuoso
  // scroller. Asserting against that scroller (rather than a stand-in div)
  // proves the exempt subtree really does cover where the events come from.
  it('survives a scroll of the picker grid', () => {
    const onClose = vi.fn();

    render(
      <FloatingPopover
        open
        onClose={onClose}
        anchor={rectAnchor({ x: 10, y: 10, width: 20, height: 20 })}
        closeOnScroll
      >
        <EmojiPicker onEmojiClick={() => {}} />
      </FloatingPopover>
    );

    // react-virtuoso tags its scrollable element with this testid.
    scroll(screen.getByTestId('virtuoso-scroller'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
