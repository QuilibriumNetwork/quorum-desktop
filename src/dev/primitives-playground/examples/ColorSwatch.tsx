import React, { useState } from 'react';
import { ColorSwatch, Flex } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: "colorswatch-primitive",
  title: "ColorSwatch",
  description: "Color selection component with visual feedback",
  background: "modal",
  columns: 4,
  dynamicProps: {
    size: {
      type: "select",
      options: ["small", "medium", "large"],
      default: "medium",
      label: "Size"
    }
  },
  staticExamples: [
    { name: "Blue", props: { color: "#3B82F6" }, children: null },
    { name: "Green", props: { color: "#10B981" }, children: null },
    { name: "Red", props: { color: "#EF4444" }, children: null },
    { name: "Disabled", props: { color: "#6B7280", disabled: true }, children: null }
  ],
  quickTips: [
    "Use for color selection interfaces",
    "isActive prop shows selection state",
    "showCheckmark adds visual confirmation",
    "Supports click/press interactions"
  ],
  codeExample: {
    title: "Color Picker",
    code: "import { ColorSwatch } from '@/components/primitives';\n\nconst colors = ['#3B82F6', '#10B981', '#EF4444'];\n\n<FlexRow gap=\"sm\">\n  {colors.map(color => (\n    <ColorSwatch\n      key={color}\n      color={color}\n      isActive={selectedColor === color}\n      onPress={() => setSelectedColor(color)}\n    />\n  ))}\n</FlexRow>"
  }
} as const;

export const ColorSwatchExamples: React.FC = () => {
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'medium',
  });
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

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
            <ColorSwatch
              {...example.props}
              size={dynamicProps.size}
              onPress={() => {
                if (!('disabled' in example.props) || !example.props.disabled) {
                  setSelectedColor(example.props.color);
                }
              }}
              isActive={selectedColor === example.props.color}
            />
            <span className="text-xs text-subtle text-center">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};