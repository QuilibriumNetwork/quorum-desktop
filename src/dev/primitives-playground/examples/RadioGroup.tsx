import React, { useState } from 'react';
import { RadioGroup } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: "radiogroup-primitive",
  title: "RadioGroup",
  description: "Cross-platform radio button group for single selection with Input primitive styling",
  background: "modal",
  columns: 3,
  dynamicProps: {
    direction: {
      type: "select",
      options: ["vertical", "horizontal"],
      default: "vertical",
      label: "Direction"
    },
    variant: {
      type: "select",
      options: ["default", "bordered"],
      default: "default",
      label: "Variant"
    }
  },
  staticExamples: [
    { name: "Theme Icons", props: { options: [{ label: "Light", value: "light", icon: "sun" }, { label: "Dark", value: "dark", icon: "moon" }, { label: "System", value: "system", icon: "desktop" }] }, children: null },
    { name: "Icon Only (Default)", props: { options: [{ label: "Light", value: "light", icon: "sun" }, { label: "Dark", value: "dark", icon: "moon" }, { label: "System", value: "system", icon: "desktop" }], iconOnly: true, direction: "horizontal" }, children: null },
    { name: "Disabled Option", props: { options: [{ label: "Available", value: "available" }, { label: "Coming Soon", value: "soon", disabled: true }, { label: "Premium", value: "premium" }] }, children: null }
  ],
  quickTips: [
    "Height and text size match Input primitive (42px, 16px)",
    "Border radius matches Input primitive (0.5rem)",
    "Use variant='default' for no border (like Input default)",
    "Use variant='bordered' for explicit border",
    "Use iconOnly=true for circular icon buttons",
    "Add icons for visual context"
  ],
  codeExample: {
    title: "Theme RadioGroup Example",
    code: "import { RadioGroup } from '@/components/primitives';\n\n// Theme options using Icon primitive names\nconst themeOptions = [\n  { label: 'Light', value: 'light', icon: 'sun' },\n  { label: 'Dark', value: 'dark', icon: 'moon' },\n  { label: 'System', value: 'system', icon: 'desktop' }\n];\n\n// Default variant (no border)\n<RadioGroup\n  options={themeOptions}\n  value={theme}\n  onChange={setTheme}\n  variant=\"default\"\n  direction=\"vertical\"\n/>\n\n// Bordered variant\n<RadioGroup\n  options={themeOptions}\n  value={theme}\n  onChange={setTheme}\n  variant=\"bordered\"\n  direction=\"vertical\"\n/>\n\n// Icon-only circular buttons\n<RadioGroup\n  options={themeOptions}\n  value={theme}\n  onChange={setTheme}\n  iconOnly={true}\n  variant=\"default\"\n  direction=\"horizontal\"\n/>"
  }
} as const;

export const RadioGroupExamples: React.FC = () => {
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    direction: config.dynamicProps.direction?.default || 'vertical',
  });
  const [radioValues, setRadioValues] = useState<Record<string, string>>({});

  const handleRadioChange = (index: number, value: string) => {
    setRadioValues(prev => ({
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
            <RadioGroup
              {...example.props}
              {...dynamicProps}
              value={radioValues[index] || ''}
              onChange={(value) => handleRadioChange(index, value)}
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