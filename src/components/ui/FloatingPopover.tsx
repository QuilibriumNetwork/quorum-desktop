import * as React from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  hide,
  autoUpdate,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  FloatingFocusManager,
  type Placement,
  type ReferenceType,
  type VirtualElement,
} from '@floating-ui/react';

/**
 * FloatingPopover — the app's single trigger-anchored popover primitive.
 *
 * Wraps @floating-ui/react with the project's positioning defaults (gap,
 * flip, viewport shift) and the accessibility wiring (escape-to-close,
 * outside-click-to-close, dialog role, focus management) so that every
 * anchored floating surface gets the same behaviour from one place.
 *
 * First adopter: UserProfile (sidebar / mention / message-avatar / bookmarks).
 * Designed so the other anchored surfaces (emoji picker, mention dropdown,
 * context menu, icon picker, markdown toolbar) can migrate onto it later.
 *
 * Architecture note — why the anchor is passed through `elements.reference`
 * (held in state) rather than `refs.setReference` in an effect:
 * Floating UI requires the reference element to be REACTIVE so useDismiss /
 * useInteractions can reason about it and middleware can position against it
 * in the same render the popover opens. Wiring it via a useEffect defers it
 * by one render, which made the card mis-position on first paint and let
 * dismissal/visibility logic misfire (closing the card the instant it opened).
 * See floating-ui docs: "The elements must be held in state (not plain refs)".
 */

export interface FloatingPopoverProps {
  open: boolean;
  /** Called whenever the popover should close (outside press, escape). */
  onClose: () => void;
  /**
   * The trigger the popover is anchored to. Either a real DOM node (e.g.
   * captured from a click event) or a floating-ui *virtual element* — any
   * object exposing `getBoundingClientRect()`. Virtual elements let surfaces
   * anchor to a point or a measured rect that has no backing element, e.g. a
   * right-click position, a text-caret rect, or a text-selection rect. The
   * value is passed straight through to floating-ui's `elements.reference`,
   * which supports both natively.
   */
  anchor?: HTMLElement | VirtualElement | null;
  /** Preferred placement; flips automatically when it doesn't fit. */
  placement?: Placement;
  /** Gap in px between the anchor and the floating element. */
  gap?: number;
  /** Min distance in px the floating element keeps from the viewport edge. */
  viewportPadding?: number;
  /**
   * When true, manage focus inside the card while open. Defaults to true.
   * Focus is NOT returned to the trigger on close (returnFocus={false}) to
   * avoid a focus-return → re-open loop when switching between triggers.
   */
  manageFocus?: boolean;
  /** Stacking context for the portalled floating element. */
  zIndex?: number;
  /** ARIA role for the floating element. Defaults to 'dialog'. */
  role?: 'dialog' | 'menu' | 'listbox' | 'tooltip';
  /**
   * Close the popover once its anchor scrolls fully out of view. The card
   * stays pinned to the anchor while it's visible (following it as the list
   * scrolls) and only closes when the anchor leaves the viewport. Defaults to
   * true.
   */
  closeWhenAnchorHidden?: boolean;
  /**
   * Close the popover as soon as any scroll happens. Use for anchors inside a
   * virtualized list (react-virtuoso): those items move via CSS transforms
   * that JS positioning can't track in lockstep, so following them lags on
   * fast scroll. Closing on scroll (as Discord/Slack do) avoids the lag
   * entirely. Defaults to false (other surfaces follow the anchor instead).
   */
  closeOnScroll?: boolean;
  /**
   * Position the floating element via `top`/`left` instead of floating-ui's
   * default `transform: translate(...)`. Set this when the popover's own CSS
   * animates `transform` (e.g. a `scale()` open animation): a transform-based
   * keyframe would otherwise override floating-ui's positioning transform and
   * the element would animate from the viewport origin (0,0). Defaults to
   * false (transform positioning — slightly cheaper, fine for opacity-only or
   * non-animated surfaces). See floating-ui `useFloating({ transform })`.
   */
  positionViaLayout?: boolean;
  className?: string;
  /**
   * Extra inline styles merged onto the floating element. Use for sizing the
   * surface (e.g. a dynamic `width`); positioning and `zIndex` are owned by
   * the primitive and applied first, so avoid overriding `position`/`top`/
   * `left`/`transform` here.
   */
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const DEFAULT_GAP = 8;
const DEFAULT_VIEWPORT_PADDING = 16;

export const FloatingPopover: React.FC<FloatingPopoverProps> = ({
  open,
  onClose,
  anchor,
  placement = 'right-start',
  gap = DEFAULT_GAP,
  viewportPadding = DEFAULT_VIEWPORT_PADDING,
  manageFocus = true,
  zIndex = 9999,
  role = 'dialog',
  closeWhenAnchorHidden = true,
  closeOnScroll = false,
  positionViaLayout = false,
  className,
  style,
  children,
}) => {
  // Keep onClose identity-stable inside effects/callbacks: callers often pass
  // a fresh closure each render, which would otherwise re-arm listeners and
  // can fire close spuriously. We read the latest via a ref.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  const { refs, floatingStyles, context, middlewareData } = useFloating({
    open,
    onOpenChange: (next) => {
      if (!next) onCloseRef.current();
    },
    placement,
    // 'fixed' positions relative to the viewport — the right strategy for a
    // body-portalled popover (immune to transformed/positioned ancestors and
    // to page scroll affecting the offset parent).
    strategy: 'fixed',
    // When the floating element animates its own transform, position via
    // top/left so the keyframe doesn't clobber floating-ui's translate.
    transform: !positionViaLayout,
    // Reference held in state (reactive) — the critical fix vs. setReference
    // in an effect. floating-ui sees the anchor the same render open flips.
    // The controlled `elements.reference` option is typed `Element` but
    // floating-ui supports virtual elements (any { getBoundingClientRect })
    // here at runtime — it only calls getBoundingClientRect for positioning.
    // Cast through the option's narrower type; `anchor` is validated as
    // HTMLElement | VirtualElement | null by the prop type.
    elements: { reference: (anchor ?? null) as Element | null },
    middleware: [
      offset(gap),
      // Flip handles BOTH axes:
      // - mainAxis: side flip (right↔left, top↔bottom) when the side is full.
      // - crossAxis + fallbackAxisSideDirection: when a *-start card near the
      //   bottom would extend past the viewport, flip its alignment so the
      //   card's bottom anchors to the trigger and it extends UPWARD — the
      //   whole card moves up to stay fully visible (no internal scroll).
      flip({
        padding: viewportPadding,
        crossAxis: true,
        fallbackAxisSideDirection: 'end',
      }),
      // Final clamp: slide along the cross-axis so any remaining overflow is
      // pulled back into the viewport. Runs after flip as the safety net.
      shift({ padding: viewportPadding }),
      // Reports when the anchor is scrolled out of view (referenceHidden) so
      // we can close — the card follows the anchor while visible and only
      // dismisses once it leaves the viewport.
      hide(),
    ],
    // Recompute position on scroll, resize and layout shifts. Default
    // autoUpdate (listener-based, no animationFrame polling) keeps the card
    // glued to the anchor as the list scrolls without the per-frame lag.
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  });
  const roleProps = useRole(context, { role });
  const { getFloatingProps } = useInteractions([dismiss, roleProps]);

  // Close once the anchor has scrolled fully out of view. Until then the card
  // stays pinned and follows the anchor (autoUpdate). referenceHidden is only
  // true when the anchor is genuinely off-screen, so normal reading scrolls
  // keep the card open. (Ignored when closeOnScroll handles scrolling.)
  const referenceHidden = middlewareData.hide?.referenceHidden;
  React.useEffect(() => {
    if (open && !closeOnScroll && closeWhenAnchorHidden && referenceHidden) {
      onCloseRef.current();
    }
  }, [open, closeOnScroll, closeWhenAnchorHidden, referenceHidden]);

  // Close on any scroll — for anchors inside a virtualized list whose items
  // move via transforms JS positioning can't track in lockstep. Capture phase
  // catches scrolls on nested scrollers (the message list), not just window.
  React.useEffect(() => {
    if (!open || !closeOnScroll) return;
    const handleScroll = () => onCloseRef.current();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [open, closeOnScroll]);

  if (!open || !anchor) return null;

  const floating = (
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, zIndex, ...style }}
      className={className}
      {...getFloatingProps()}
    >
      {children}
    </div>
  );

  return (
    <FloatingPortal>
      {manageFocus ? (
        // returnFocus={false}: returning focus to the previous trigger on
        // close fights with switching to a new trigger and can re-open the
        // card (floating-ui issue #3366).
        <FloatingFocusManager
          context={context}
          modal={false}
          returnFocus={false}
        >
          {floating}
        </FloatingFocusManager>
      ) : (
        floating
      )}
    </FloatingPortal>
  );
};

/**
 * Build a floating-ui virtual element that anchors to a fixed rect — a point
 * (right-click, caret) or a measured region (text selection). Pass the result
 * as <FloatingPopover anchor>. The rect is captured by value, so callers should
 * memoize the call when the point/region is stable across renders.
 */
export function rectAnchor(rect: {
  x: number;
  y: number;
  width?: number;
  height?: number;
}): VirtualElement {
  const { x, y, width = 0, height = 0 } = rect;
  return {
    getBoundingClientRect: () => ({
      x,
      y,
      top: y,
      left: x,
      right: x + width,
      bottom: y + height,
      width,
      height,
    }),
  };
}

export type { Placement, ReferenceType, VirtualElement };

export default FloatingPopover;
