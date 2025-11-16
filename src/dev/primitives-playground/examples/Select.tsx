import React, { useState } from 'react';
import { Select } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: 'select-primitive',
  title: 'Select',
  description: 'Cross-platform select dropdown component',
  background: 'modal',
  columns: 4,
  dynamicProps: {
    size: {
      type: 'select',
      options: ['small', 'medium', 'large'],
      default: 'medium',
      label: 'Size',
    },
  },
  staticExamples: [
    {
      name: 'Basic Select',
      props: {
        placeholder: 'Choose option...',
        options: [
          { label: 'Option 1', value: '1' },
          { label: 'Option 2', value: '2' },
          { label: 'Option 3', value: '3' },
        ],
      },
    },
    {
      name: 'With Icons',
      props: {
        placeholder: 'Select size...',
        options: [
          { label: 'Small', value: 'sm', icon: '📱' },
          { label: 'Medium', value: 'md', icon: '💻' },
          { label: 'Large', value: 'lg', icon: '🖥️' },
        ],
      },
    },
    {
      name: 'With Subtitles',
      props: {
        placeholder: 'Select user...',
        options: [
          { label: 'John Doe', value: 'john', subtitle: 'john@example.com' },
          { label: 'Jane Smith', value: 'jane', subtitle: 'jane@example.com' },
        ],
      },
    },
    {
      name: 'Multiselect',
      props: {
        placeholder: 'Choose multiple...',
        multiple: true,
        options: [
          { label: 'React', value: 'react' },
          { label: 'Vue', value: 'vue' },
          { label: 'Angular', value: 'angular' },
          { label: 'Svelte', value: 'svelte' },
        ],
      },
    },
    {
      name: 'Compact Filter',
      props: {
        compactMode: true,
        compactIcon: 'filter',
        multiple: true,
        showSelectAllOption: false,
        options: [
          { label: 'You', value: 'you', subtitle: 'Direct @mentions' },
          { label: 'Everyone', value: 'everyone', subtitle: '@everyone mentions' },
          { label: 'Roles', value: 'roles', subtitle: '@role mentions' },
        ],
      },
    },
    {
      name: 'Compact Settings',
      props: {
        compactMode: true,
        compactIcon: 'settings',
        showSelectionCount: true,
        multiple: true,
        options: [
          { label: 'Notifications', value: 'notif' },
          { label: 'Privacy', value: 'privacy' },
          { label: 'Security', value: 'security' },
        ],
      },
    },
    {
      name: 'Bordered',
      props: {
        placeholder: 'Bordered select',
        variant: 'bordered',
        options: [
          { label: 'Option A', value: 'a' },
          { label: 'Option B', value: 'b' },
        ],
      },
    },
    {
      name: 'Disabled',
      props: {
        disabled: true,
        placeholder: 'Disabled select',
        options: [{ label: 'Option 1', value: '1' }],
      },
    },
    {
      name: 'With Error',
      props: {
        error: true,
        errorMessage: 'Please select an option',
        placeholder: 'Error state',
        options: [{ label: 'Option 1', value: '1' }],
      },
    },
  ],
  quickTips: [
    'Always provide clear option labels',
    'Use placeholder text for initial state',
    'Add icons and subtitles for rich options',
    'Use multiple=true for multiselect functionality',
    'Use compactMode=true for icon-only filter buttons',
    'Add showSelectionCount=true to display badge with count',
    "Use variant='bordered' for forms on light backgrounds",
    'Show error states with clear messages',
  ],
  codeExample: {
    title: 'Form Select',
    code: `import { Select } from '@/components/primitives';

const options = [
  { label: 'Small', value: 'sm' },
  { label: 'Medium', value: 'md' },
  { label: 'Large', value: 'lg' }
];

<Select
  options={options}
  value={selectedSize}
  onChange={setSelectedSize}
  placeholder="Choose size"
/>`,
  },
} as const;

export const SelectExamples: React.FC = () => {
  const [selectValues, setSelectValues] = useState<Record<string, string>>({});
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'medium',
  });

  const handleSelectChange = (index: number, value: string) => {
    setSelectValues(prev => ({
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
            <Select
              {...example.props}
              {...dynamicProps}
              value={selectValues[index] || ''}
              onChange={(value) => handleSelectChange(index, value)}
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