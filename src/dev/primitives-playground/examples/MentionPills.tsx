import React, { useState, useRef, useEffect } from 'react';
import { ExampleBox } from '../ExampleBox';
import { Text } from '@/components/primitives';

/**
 * POC Demo: Mention Pills using contentEditable
 *
 * This is a proof-of-concept to test the contentEditable approach for mention pills
 * as outlined in the research phase of the mention pills task.
 *
 * Goals:
 * - Test contentEditable with inline pill rendering
 * - Test cursor positioning and selection
 * - Test backspace deletion (whole pill)
 * - Test different mention types
 * - NOT integrated with real mention system yet
 */

interface MentionPill {
  id: string;
  type: 'user' | 'role' | 'channel' | 'everyone';
  displayName: string;
  address: string; // The actual ID that would be stored
  useEnhancedFormat?: boolean; // Whether to use enhanced format @[Name]<address> or legacy @<address>
}

// Mock data for testing - includes both legacy and enhanced formats
const MOCK_MENTIONS: MentionPill[] = [
  { id: 'pill-1', type: 'user', displayName: 'John Doe', address: 'QmAbc123', useEnhancedFormat: true },
  { id: 'pill-2', type: 'user', displayName: 'Jane Smith', address: 'QmDef456', useEnhancedFormat: false },
  { id: 'pill-3', type: 'role', displayName: 'Developers', address: 'developers' },
  { id: 'pill-4', type: 'channel', displayName: 'general', address: 'ch-gen123', useEnhancedFormat: true },
  { id: 'pill-5', type: 'channel', displayName: 'announcements', address: 'ch-ann456', useEnhancedFormat: false },
  { id: 'pill-6', type: 'everyone', displayName: 'everyone', address: 'everyone' },
];

const MentionPillComponent: React.FC<{ mention: MentionPill; onDelete: () => void }> = ({
  mention,
  onDelete
}) => {
  const colors = {
    user: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
    role: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
    channel: 'bg-green-500/20 text-green-700 dark:text-green-300',
    everyone: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  };

  const prefix = {
    user: '@',
    role: '@',
    channel: '#',
    everyone: '@',
  };

  return (
    <span
      contentEditable={false}
      data-mention-id={mention.id}
      data-mention-address={mention.address}
      data-mention-type={mention.type}
      className={`inline-flex items-center px-2 py-0.5 mx-0.5 rounded text-sm font-medium ${colors[mention.type]} cursor-pointer select-none`}
      style={{ userSelect: 'none' }}
      onClick={onDelete}
      title={`${mention.type}: ${mention.address} (click to remove)`}
    >
      {prefix[mention.type]}{mention.displayName}
    </span>
  );
};

const ContentEditableDemo: React.FC<{
  placeholder?: string;
  initialPills?: MentionPill[];
}> = ({ placeholder = 'Type here...', initialPills = [] }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [pills, setPills] = useState<MentionPill[]>(initialPills);

  // Insert a mention pill at cursor
  const insertPill = (mention: MentionPill) => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Create pill element
    const pillSpan = document.createElement('span');
    pillSpan.contentEditable = 'false';
    pillSpan.dataset.mentionId = mention.id;
    pillSpan.dataset.mentionAddress = mention.address;
    pillSpan.dataset.mentionType = mention.type;
    pillSpan.dataset.mentionDisplayName = mention.displayName;
    pillSpan.dataset.mentionEnhanced = mention.useEnhancedFormat ? 'true' : 'false';
    pillSpan.className = `inline-flex items-center px-2 py-0.5 mx-0.5 rounded text-sm font-medium cursor-pointer select-none ${
      mention.type === 'user' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300' :
      mention.type === 'role' ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300' :
      mention.type === 'channel' ? 'bg-green-500/20 text-green-700 dark:text-green-300' :
      'bg-orange-500/20 text-orange-700 dark:text-orange-300'
    }`;
    const prefix = mention.type === 'channel' ? '#' : '@';
    pillSpan.textContent = `${prefix}${mention.displayName}`;
    pillSpan.style.userSelect = 'none';

    // Add click handler to remove pill
    pillSpan.addEventListener('click', () => {
      pillSpan.remove();
      setPills(prev => prev.filter(p => p.id !== mention.id));
    });

    // Insert pill
    range.deleteContents();
    range.insertNode(pillSpan);

    // Add space after pill
    const space = document.createTextNode('\u00A0');
    range.setStartAfter(pillSpan);
    range.insertNode(space);

    // Move cursor after space
    range.setStartAfter(space);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    setPills(prev => [...prev, mention]);
  };

  // Handle backspace to delete pills
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (!range.collapsed) return; // Let default behavior handle text selection

      // Check if cursor is right after a pill
      const { startContainer, startOffset } = range;

      if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
        const prevSibling = startContainer.previousSibling;
        if (prevSibling && (prevSibling as HTMLElement).dataset?.mentionId) {
          e.preventDefault();
          const mentionId = (prevSibling as HTMLElement).dataset.mentionId!;
          prevSibling.remove();
          setPills(prev => prev.filter(p => p.id !== mentionId));
        }
      } else if (startContainer.nodeType === Node.ELEMENT_NODE) {
        const prevChild = (startContainer as HTMLElement).childNodes[startOffset - 1];
        if (prevChild && (prevChild as HTMLElement).dataset?.mentionId) {
          e.preventDefault();
          const mentionId = (prevChild as HTMLElement).dataset.mentionId!;
          prevChild.remove();
          setPills(prev => prev.filter(p => p.id !== mentionId));
        }
      }
    }
  };

  // Extract text with IDs (simulating storage format)
  const extractText = () => {
    if (!editorRef.current) return '';

    let text = '';
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.dataset?.mentionId && el.dataset?.mentionAddress) {
          const prefix = el.dataset.mentionType === 'channel' ? '#' : '@';
          const displayName = el.dataset.mentionDisplayName;
          const useEnhanced = el.dataset.mentionEnhanced === 'true';

          // Format based on type and enhanced flag
          if (el.dataset.mentionType === 'role') {
            // Roles always use @roleTag format (no brackets)
            text += `@${el.dataset.mentionAddress}`;
          } else if (el.dataset.mentionType === 'everyone') {
            // @everyone always same format
            text += '@everyone';
          } else if (useEnhanced && displayName) {
            // Enhanced format: @[Display Name]<address> or #[Channel Name]<channelId>
            text += `${prefix}[${displayName}]<${el.dataset.mentionAddress}>`;
          } else {
            // Legacy format: @<address> or #<channelId>
            text += `${prefix}<${el.dataset.mentionAddress}>`;
          }
        } else {
          node.childNodes.forEach(walk);
        }
      }
    };
    editorRef.current.childNodes.forEach(walk);
    return text.trim();
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={editorRef}
        contentEditable
        onKeyDown={handleKeyDown}
        className="min-h-[100px] p-3 rounded border border-default bg-field focus:outline-none focus:border-accent"
        data-placeholder={placeholder}
        style={{
          position: 'relative',
        }}
        suppressContentEditableWarning
      />

      <div className="flex flex-wrap gap-2">
        {MOCK_MENTIONS.map((mention) => (
          <button
            key={mention.id}
            onClick={() => insertPill(mention)}
            className="px-2 py-1 text-xs rounded bg-surface-3 hover:bg-surface-4 text-main"
          >
            Insert {mention.type === 'channel' ? '#' : '@'}{mention.displayName}
          </button>
        ))}
      </div>

      <div className="text-xs text-subtle p-2 bg-surface-1 rounded">
        <strong>Storage format:</strong> {extractText() || '(empty)'}
      </div>
    </div>
  );
};

const config = {
  id: "mentionpills-demo",
  title: "Mention Pills (POC Demo)",
  description: "Proof-of-concept for contentEditable mention pills - Web implementation",
  background: "modal",
  columns: 1,
  dynamicProps: {},
  staticExamples: [
    {
      name: "Basic contentEditable with Pills",
      component: <ContentEditableDemo placeholder="Type text and click buttons to insert mention pills..." />
    },
  ],
  quickTips: [
    "Click buttons to insert mention pills at cursor position",
    "Type regular text around the pills",
    "Press backspace to delete pills (whole pill removed at once)",
    "Click pills to remove them",
    "Pills are non-editable inline elements",
    "Storage format shows both formats:",
    "  - Enhanced: @[John Doe]<QmAbc123> or #[general]<ch-gen123>",
    "  - Legacy: @<QmDef456> or #<ch-ann456>",
    "  - Roles: @developers (always same format)",
    "This is a POC - NOT integrated with real mention system yet"
  ],
  codeExample: {
    title: "ContentEditable Approach",
    code: `// Core concept: contentEditable with non-editable pill spans

<div contentEditable onKeyDown={handleBackspace}>
  Regular text
  <span
    contentEditable={false}
    data-mention-id="pill-1"
    data-mention-address="QmAbc123"
    className="pill-style"
  >
    @John Doe
  </span>
  more text
</div>

// Key challenges tested:
// 1. Cursor positioning after pill insertion
// 2. Backspace deletion of whole pills
// 3. Click to remove pills
// 4. Extracting storage format: "@<address>"
// 5. Different mention types with color coding`
  }
} as const;

export const MentionPillsExamples: React.FC = () => {
  return (
    <div id={config.id}>
      <ExampleBox
        title={config.title}
        description={config.description}
        columns={config.columns as 1 | 2 | 3 | 4}
        background={config.background as any}
        notes={{
          quickTips: config.quickTips,
          codeExample: config.codeExample,
        }}
      >
        {config.staticExamples.map((example, index) => (
          <div key={index} className="flex flex-col gap-2 p-3">
            {example.component}
            <span className="text-xs text-subtle">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};
