import { Button } from '../primitives';
import {
  insertHeading,
  toggleBold,
  insertBlockQuote,
  toggleItalic,
  wrapCode,
  toggleStrikethrough,
  FormatFunction,
} from '../../utils/markdownFormatting';
import './MarkdownToolbar.scss';

export interface MarkdownToolbarProps {
  visible: boolean;
  position: { top: number; left: number };
  onFormat: (formatFn: FormatFunction) => void;
}

/**
 * Markdown formatting toolbar
 * Appears above selected text in MessageComposer
 */
export function MarkdownToolbar({
  visible,
  position,
  onFormat,
}: MarkdownToolbarProps) {
  if (!visible) return null;

  return (
    <div
      className="markdown-toolbar"
      style={{ top: position.top, left: position.left }}
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
    </div>
  );
}
