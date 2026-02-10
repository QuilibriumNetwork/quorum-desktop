import React, { useState } from 'react';
import { Flex, Container, Button } from '@/components/primitives';
import { Icon } from '@/components/primitives';
import { InteractivePropsPanel } from './InteractivePropsPanel';

interface ExampleNote {
  quickTips: string[];
  codeExample?: {
    title: string;
    code: string;
  };
  apiReference?: boolean;
}

interface ExampleBoxProps {
  title: string;
  description: string;
  columns?: 1 | 2 | 3 | 4;
  background?: 'chat' | 'modal' | 'surface-1' | 'surface-2' | 'surface-3';
  children: React.ReactNode;
  notes: ExampleNote;
  dynamicProps?: Record<string, any>;
  onDynamicPropsChange?: (props: Record<string, any>) => void;
  className?: string;
  hideLabels?: boolean;
}

const backgroundClasses = {
  'chat': 'bg-chat',
  'modal': 'bg-modal',
  'surface-1': 'bg-surface-1',
  'surface-2': 'bg-surface-2',
  'surface-3': 'bg-surface-3',
} as const;

export const ExampleBox: React.FC<ExampleBoxProps> = ({
  title,
  description,
  columns = 3,
  background = 'chat',
  children,
  notes,
  dynamicProps,
  onDynamicPropsChange,
  className = '',
  hideLabels = false,
}) => {
  const [showCodeExample, setShowCodeExample] = useState(false);
  const [showPropsPanel, setShowPropsPanel] = useState(false);
  const [showCodeCopied, setShowCodeCopied] = useState(false);

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns];

  const bgClass = backgroundClasses[background];

  const copyCodeToClipboard = () => {
    if (notes.codeExample) {
      navigator.clipboard.writeText(notes.codeExample.code).then(() => {
        setShowCodeCopied(true);
        setTimeout(() => setShowCodeCopied(false), 2000);
      });
    }
  };

  return (
    <Container className={`space-y-4 ${className}`}>
      {/* Header */}
      <Flex justify="between">
        <Flex direction="column" gap="xs">
          <span className="text-3xl font-bold">{title}</span>
          <span className="text-subtle">{description}</span>
        </Flex>

        <Flex gap="xs">
          {dynamicProps && (
            <Button
              type="subtle"
              iconName="sliders"
              iconOnly
              onClick={() => setShowPropsPanel(!showPropsPanel)}
              tooltip={showPropsPanel ? "Hide Props Panel" : "Show Props Panel"}
            />
          )}
        </Flex>
      </Flex>

      {/* Interactive Props Panel */}
      {dynamicProps && showPropsPanel && (
        <div className="border border-surface-4 rounded-lg p-4 bg-surface-0">
          <InteractivePropsPanel
            dynamicProps={dynamicProps}
            onChange={onDynamicPropsChange || (() => {})}
          />
        </div>
      )}

      {/* Examples Grid */}
      <div className={`${bgClass} rounded-lg p-6`}>
        <div className={`grid ${gridCols} gap-4 auto-rows-min [&_span.text-xs]:text-left [&>div]:items-start ${hideLabels ? '[&_span.text-xs]:hidden' : ''}`}>
          {children}
        </div>
      </div>

      {/* Footer Notes */}
      <Flex direction="column" gap="sm" className="border-t border-surface-4 pt-4">
        {/* Quick Tips */}
        <Flex direction="column" gap="xs">
          <span className="text-sm font-semibold">Quick Tips:</span>
          <div className="space-y-1">
            {notes.quickTips.map((tip, index) => (
              <Flex key={index} gap="xs" align="start">
                <span className="text-sm text-subtle mt-0.5">•</span>
                <span className="text-sm text-subtle">{tip}</span>
              </Flex>
            ))}
          </div>
        </Flex>

        {/* Code Example Toggle */}
        {notes.codeExample && (
          <Flex direction="column" gap="sm">
            <div className="self-start">
              <Button
                type="subtle"
                size="small"
                iconName="code"
                onClick={() => setShowCodeExample(!showCodeExample)}
              >
                {notes.codeExample.title}
              </Button>
            </div>

            {showCodeExample && (
              <div className="bg-surface-0 rounded-md border border-surface-4">
                <Flex justify="between" className="px-3 py-2 border-b border-surface-4">
                  <span className="text-sm text-subtle">Code Example</span>
                  <Button
                    type="subtle"
                    size="small"
                    iconName="copy"
                    onClick={copyCodeToClipboard}
                  >
                    {showCodeCopied ? 'Copied!' : 'Copy'}
                  </Button>
                </Flex>
                <pre className="text-sm text-subtle overflow-x-auto p-3">
                  <code>{notes.codeExample.code}</code>
                </pre>
              </div>
            )}
          </Flex>
        )}

      </Flex>
    </Container>
  );
};