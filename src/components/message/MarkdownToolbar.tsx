import { Button } from '../primitives';
import { FloatingPopover, type VirtualElement } from '../ui';
import {
  insertHeading,
  toggleBold,
  insertBlockQuote,
  toggleItalic,
  wrapCode,
  toggleStrikethrough,
  toggleSpoiler,
} from '@quilibrium/quorum-shared';
import type { FormatFunction } from '@quilibrium/quorum-shared';
import './MarkdownToolbar.scss';

export interface MarkdownToolbarProps {
  visible: boolean;
  /**
   * The text selection the toolbar points at, as a floating-ui virtual element
   * (a `{ getBoundingClientRect }` over the selection rect). FloatingPopover
   * centers the toolbar above it and flips/clamps near viewport edges.
   */
  anchor: VirtualElement | null;
  onFormat: (formatFn: FormatFunction) => void;
}

/**
 * Markdown formatting toolbar
 * Appears above selected text in MessageComposer
 */
export function MarkdownToolbar({
  visible,
  anchor,
  onFormat,
}: MarkdownToolbarProps) {
  return (
    <FloatingPopover
      open={visible}
      onClose={() => {}}
      anchor={anchor}
      // Centered above the selection; flips below near the viewport top.
      placement="top"
      gap={12}
      role="tooltip"
      // The composer owns visibility (selection / blur / format); the toolbar
      // must not steal focus from the editor or self-dismiss on interactions.
      manageFocus={false}
      closeWhenAnchorHidden={false}
      // The toolbar's fade-in animates transform — position via top/left so it
      // doesn't fight floating-ui's positioning transform.
      positionViaLayout
      className="markdown-toolbar"
    >
      <Button
        type="unstyled"
        size="compact"
        iconName="heading"
        iconOnly
        onClick={() => onFormat(insertHeading)}
      />
      <Button
        type="unstyled"
        size="compact"
        iconName="bold"
        iconOnly
        onClick={() => onFormat(toggleBold)}
      />
      <Button
        type="unstyled"
        size="compact"
        iconName="quote"
        iconOnly
        onClick={() => onFormat(insertBlockQuote)}
      />
      <Button
        type="unstyled"
        size="compact"
        iconName="italic"
        iconOnly
        onClick={() => onFormat(toggleItalic)}
      />
      <Button
        type="unstyled"
        size="compact"
        iconName="code"
        iconOnly
        onClick={() => onFormat(wrapCode)}
      />
      <Button
        type="unstyled"
        size="compact"
        iconName="strikethrough"
        iconOnly
        onClick={() => onFormat(toggleStrikethrough)}
      />
      <Button
        type="unstyled"
        size="compact"
        iconName="eye-off"
        iconOnly
        onClick={() => onFormat(toggleSpoiler)}
      />
    </FloatingPopover>
  );
}
