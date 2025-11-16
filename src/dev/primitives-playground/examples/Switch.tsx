import React, { useState } from 'react';
import { Switch } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: 'switch-primitive',
  title: 'Switch',
  description: 'Cross-platform toggle switch component',
  background: 'modal',
  columns: 3,
  dynamicProps: {
    size: {
      type: 'select',
      options: ['small', 'medium', 'large'],
      default: 'medium',
      label: 'Size',
    },
  },
  staticExamples: [
    { name: 'Default Off', props: { defaultValue: false } },
    { name: 'Default On', props: { defaultValue: true } },
    { name: 'Disabled Off', props: { defaultValue: false, disabled: true } },
    { name: 'Disabled On', props: { defaultValue: true, disabled: true } },
    { name: 'With Label', props: { defaultValue: false, label: 'Enable notifications' } },
    { name: 'Interactive', props: { defaultValue: false } },
  ],
  quickTips: [
    'Use for binary on/off settings',
    'Always provide clear labels for accessibility',
    'Consider disabled state for unavailable options',
    'Switch should provide immediate feedback',
  ],
  codeExample: {
    title: 'All Switch Props',
    code: `import { Switch } from '@/components/primitives';

const [enabled, setEnabled] = useState(false);

<Switch
  // Required props
  value={enabled}
  onChange={setEnabled}

  // States
  disabled={false}

  // Sizing (web)
  size="medium" // 'small' | 'medium' | 'large'
  variant="default" // Only 'default' currently supported

  // Styling
  className="custom-switch"
  style={{ margin: 10 }}

  // Accessibility
  accessibilityLabel="Toggle dark mode"
  testID="dark-mode-switch"

  // Native-specific props
  // hapticFeedback={true} // iOS haptic feedback
  // trackColorFalse="#767577" // Android track color when off
  // trackColorTrue="#81b0ff" // Android track color when on
  // thumbColor="#f5dd4b" // Thumb color for both platforms
/>`,
  },
} as const;

export const SwitchExamples: React.FC = () => {
  const [switchStates, setSwitchStates] = useState<Record<string, boolean>>({});
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'medium',
  });

  const handleSwitchChange = (index: number, value: boolean) => {
    setSwitchStates(prev => ({
      ...prev,
      [index]: value
    }));
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
          <div key={index} className="flex flex-col gap-2 p-3">
            <Switch
              {...example.props}
              {...dynamicProps}
              value={switchStates[index] ?? example.props.defaultValue}
              onChange={(value) => handleSwitchChange(index, value)}
            />
            <span className="text-xs text-subtle">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};