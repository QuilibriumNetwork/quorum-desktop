import React from 'react';
import { Callout } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: 'callout-primitive',
  title: 'Callout',
  description: 'Cross-platform callout component for important messages',
  background: 'surface-1',
  columns: 4,
  dynamicProps: {
    size: {
      type: 'select',
      options: ['xs', 'sm', 'md'],
      default: 'md',
      label: 'Size',
    },
    layout: {
      type: 'select',
      options: ['base', 'minimal'],
      default: 'base',
      label: 'Layout',
    },
  },
  staticExamples: [
    { name: 'Info', props: { variant: 'info' }, children: 'This is an informational callout with helpful details.' },
    { name: 'Success', props: { variant: 'success' }, children: 'Operation completed successfully!' },
    { name: 'Warning', props: { variant: 'warning' }, children: 'Please review this important warning message.' },
    { name: 'Error', props: { variant: 'error' }, children: 'An error occurred. Please check your input.' },
    { name: 'With Close', props: { variant: 'info', dismissible: true }, children: 'This callout can be dismissed with the X button.' },
  ],
  quickTips: [
    "Use variant='info' for neutral information",
    "Use variant='success' for positive feedback",
    "Use variant='warning' for cautionary messages",
    "Use variant='error' for error states and validation",
    "Use layout='minimal' for subtle notifications",
    'Add dismissible=true for closeable callouts',
    'All callouts now use solid backgrounds for better readability',
  ],
  codeExample: {
    title: 'All Callout Props',
    code: `import { Callout } from '@/components/primitives';

<Callout
  // Required
  variant="info" // 'info' | 'success' | 'warning' | 'error'
  children="Your message content here"

  // Optional sizing
  size="md" // 'xs' | 'sm' | 'md'

  // Layout variants
  layout="base" // 'base' | 'minimal'

  // Dismissible behavior
  dismissible={false}
  onClose={handleClose}

  // Auto-close timer
  autoClose={5} // seconds

  // Styling
  className="custom-class"

  // Testing
  testID="callout-test-id"
>
  Your callout message content
</Callout>`,
  },
} as const;

export const CalloutExamples: React.FC = () => {
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
            <Callout
              {...example.props}
            >
              {example.children}
            </Callout>
            <span className="text-xs text-subtle">
              variant="{example.props.variant}"
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};