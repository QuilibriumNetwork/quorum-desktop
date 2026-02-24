import { parse as parseEmoji } from '@twemoji/parser';
import type { Root, Parent, PhrasingContent, Image } from 'mdast';

/**
 * Convert emoji unicode text to the unified codepoint format used by
 * emoji-datasource-twitter filenames (e.g. "1f600", "2764-fe0f").
 *
 * Preserves FE0F (VS16) codepoints which emoji-datasource-twitter includes.
 */
function emojiToUnified(emoji: string): string {
  const codepoints: string[] = [];
  for (let i = 0; i < emoji.length; i++) {
    const code = emoji.codePointAt(i)!;
    codepoints.push(code.toString(16).padStart(4, '0'));
    if (code > 0xffff) i++;
  }
  return codepoints.join('-');
}

/**
 * Convert emoji unicode to unified codepoint string.
 * Exported for use by ReactionsList.
 */
export { emojiToUnified };

/**
 * Custom remark plugin that replaces emoji unicode characters with image nodes
 * pointing to self-hosted Twemoji PNGs at /twitter/64/{unified}.png.
 *
 * Uses @twemoji/parser for reliable emoji detection (ZWJ, skin tones, flags).
 */
export function remarkTwemoji() {
  return (tree: Root) => {
    walkNode(tree);
  };
}

function walkNode(node: Parent) {
  const children = node.children;
  if (!children) return;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (child.type === 'text') {
      const entities = parseEmoji(child.value);
      if (entities.length === 0) continue;

      const replacement: PhrasingContent[] = [];
      let lastIndex = 0;

      for (const entity of entities) {
        const [start, end] = entity.indices;

        if (start > lastIndex) {
          replacement.push({ type: 'text', value: child.value.slice(lastIndex, start) });
        }

        const unified = emojiToUnified(entity.text);
        replacement.push({
          type: 'image',
          url: `/twitter/64/${unified}.png`,
          alt: `twemoji-${unified}`,
          title: null,
        } as Image);

        lastIndex = end;
      }

      if (lastIndex < child.value.length) {
        replacement.push({ type: 'text', value: child.value.slice(lastIndex) });
      }

      // Splice replacement nodes in place of the text node
      children.splice(i, 1, ...(replacement as typeof children));
      // Skip past the replacement nodes
      i += replacement.length - 1;
    } else if ('children' in child) {
      walkNode(child as Parent);
    }
  }
}
