import { logger } from '@quilibrium/quorum-shared';
import React, { useState } from 'react';
import { Button } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: 'button-primitive',
  title: 'Button',
  description: 'Cross-platform button component for user interactions',
  background: 'modal',
  columns: 4,
  dynamicProps: {
    size: {
      type: 'select',
      options: ['compact', 'small', 'normal', 'large'],
      default: 'normal',
      label: 'Size',
    },
  },
  staticExamples: [
    { name: 'Primary', props: { type: 'primary' }, children: 'Primary Button' },
    { name: 'Secondary', props: { type: 'secondary' }, children: 'Secondary Button' },
    { name: 'Subtle', props: { type: 'subtle' }, children: 'Subtle Button' },
    { name: 'Subtle Outline', props: { type: 'subtle-outline' }, children: 'Subtle Outline' },
    { name: 'Danger', props: { type: 'danger' }, children: 'Danger Button' },
    { name: 'Danger Outline', props: { type: 'danger-outline' }, children: 'Danger Outline' },
    { name: 'Primary White', props: { type: 'primary-white' }, children: 'Primary White' },
    { name: 'Secondary White', props: { type: 'secondary-white' }, children: 'Secondary White' },
    { name: 'Light White', props: { type: 'light-white' }, children: 'Light White' },
    { name: 'Light Outline White', props: { type: 'light-outline-white' }, children: 'Light Outline White' },
    { name: 'Unstyled', props: { type: 'unstyled' }, children: 'Unstyled Button' },
    { name: 'With Icon', props: { type: 'primary', iconName: 'plus' }, children: 'Add Item' },
    { name: 'Icon Only', props: { type: 'subtle', iconName: 'settings', iconOnly: true }, children: null },
    { name: 'Full Width', props: { type: 'primary', fullWidth: true }, children: 'Full Width Button' },
    { name: 'Disabled', props: { type: 'primary', disabled: true }, children: 'Disabled' },
  ],
  quickTips: [
    "Use type='primary' for main actions, 'secondary' for alternatives",
    'Add iconName for better visual hierarchy and UX',
    'Consider fullWidth on mobile for better touch targets',
    'Always provide meaningful button text for accessibility',
  ],
  codeExample: {
    title: 'All Button Props',
    code: `import { Button } from '@/components/primitives';

<Button
  // Core props
  onClick={handleClick}
  children="Button Text"

  // Button types (choose one)
  type="primary" // 'primary' | 'secondary' | 'light' | 'light-outline' | 'subtle' | 'subtle-outline' | 'danger' | 'primary-white' | 'secondary-white' | 'light-white' | 'light-outline-white' | 'disabled-onboarding' | 'unstyled'

  // Sizes
  size="normal" // 'compact' | 'small' | 'normal' | 'large'

  // States
  disabled={false}

  // Layout
  fullWidth={false}

  // Icons
  iconName="plus" // FontAwesome icon name
  iconOnly={false} // Show only icon without text
  icon={false} // Legacy prop for compatibility

  // Tooltips
  tooltip="Helpful tooltip text"
  highlightedTooltip={false}

  // Styling
  className="custom-class"

  // Accessibility
  id="button-id"
/>`,
  },
} as const;

export const ButtonExamples: React.FC = () => {
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'normal',
  });

  const handleClick = () => {
    logger.log('Button clicked!');
  };

  return (
    <div id={config.id}>
      <ExampleBox
        title={config.title}
        description={config.description}
        columns={config.columns as 1 | 2 | 3 | 4}
        background={config.background as any}
        dynamicProps={config.dynamicProps}
        onDynamicPropsChange={setDynamicProps}
        notes={{
          quickTips: config.quickTips,
          codeExample: config.codeExample,
        }}
      >
        {config.staticExamples.map((example, index) => (
          <div key={index} className="flex flex-col items-center gap-2 p-3">
            <Button
              {...example.props}
              {...dynamicProps}
              onClick={handleClick}
            >
              {example.children}
            </Button>
            <span className="text-xs text-subtle">
              type="{example.props.type}"
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};
