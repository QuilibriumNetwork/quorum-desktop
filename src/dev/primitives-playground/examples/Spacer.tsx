import React, { useState } from 'react';
import { Spacer, Flex } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: "spacer-primitive",
  title: "Spacer",
  description: "Cross-platform spacing component for layout control",
  background: "surface-1",
  columns: 3,
  dynamicProps: {
    size: {
      type: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
      default: "md",
      label: "Size"
    }
  },
  staticExamples: [
    { name: "Horizontal Spacing", props: { direction: "horizontal" }, children: null },
    { name: "Vertical Spacing", props: { direction: "vertical" }, children: null },
    { name: "With Border", props: {}, children: null }
  ],
  quickTips: [
    "Use for consistent spacing between elements",
    "Works in both horizontal and vertical layouts",
    "Size prop controls the amount of space",
    "Better than manual margins for responsive design"
  ],
  codeExample: {
    title: "Layout Spacing",
    code: "import { Spacer, Text, Button } from '@/components/primitives';\n\n<FlexColumn>\n  <Text>First section</Text>\n  <Spacer size=\"lg\" />\n  <Text>Second section</Text>\n  <Spacer size=\"md\" />\n  <Button type=\"primary\">Action</Button>\n</FlexColumn>\n\n// SPACER-BORDER-SPACER pattern\n<FlexColumn>\n  <Text>Section 1</Text>\n  <Spacer\n    spaceBefore=\"md\"\n    spaceAfter=\"md\"\n    border={true}\n    direction=\"vertical\"\n  />\n  <Text>Section 2</Text>\n</FlexColumn>"
  }
} as const;

export const SpacerExamples: React.FC = () => {
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'md',
  });

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
          <div key={index} className="flex flex-col gap-2 p-3 min-h-[140px]">
            <div className="border border-surface-4 rounded p-2 min-h-[100px] flex items-center justify-center">
              {/* Horizontal Spacing - 3 items */}
              {index === 0 && (
                <Flex className="h-full w-full" align="center" justify="center">
                  <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs text-center">
                    Item 1
                  </div>
                  <Spacer {...example.props} size={dynamicProps.size} />
                  <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs text-center">
                    Item 2
                  </div>
                </Flex>
              )}
              {/* Vertical Spacing - 3 items */}
              {index === 1 && (
                <Flex direction="column" className="h-full w-full" align="center" justify="center">
                  <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs text-center">
                    Item A
                  </div>
                  <Spacer {...example.props} size={dynamicProps.size} />
                  <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs text-center">
                    Item B
                  </div>
                </Flex>
              )}
              {/* SPACER-BORDER-SPACER pattern */}
              {index === 2 && (
                <div className="h-full w-full flex flex-col items-center justify-center">
                  <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs text-center">
                    Section 1
                  </div>
                  <Spacer
                    spaceBefore={dynamicProps.size}
                    spaceAfter={dynamicProps.size}
                    border={true}
                    direction="vertical"
                  />
                  <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs text-center">
                    Section 2
                  </div>
                </div>
              )}
            </div>
            <span className="text-xs text-subtle text-center">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};