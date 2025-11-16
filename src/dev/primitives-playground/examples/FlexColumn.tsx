import React, { useState } from 'react';
import { FlexColumn } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: "flexcolumn-primitive",
  title: "FlexColumn",
  description: "Vertical flex layout container",
  background: "surface-1",
  columns: 1,
  dynamicProps: {
    gap: {
      type: "select",
      options: ["none", "xs", "sm", "md", "lg", "xl"],
      default: "md",
      label: "Gap"
    },
    align: {
      type: "select",
      options: ["start", "end", "center", "stretch"],
      default: "start",
      label: "Align"
    }
  },
  staticExamples: [
    { name: "Card Stack", props: {}, children: ["Header", "Content", "Footer"] }
  ],
  quickTips: [
    "Use gap prop for consistent vertical spacing",
    "align controls horizontal alignment of children",
    "Perfect for form layouts and card structures",
    "Use with padding for contained layouts"
  ],
  codeExample: {
    title: "Form Layout",
    code: "import { FlexColumn, Text, Input, Button } from '@/components/primitives';\n\n<FlexColumn gap=\"md\" align=\"stretch\">\n  <Text variant=\"strong\">Contact Form</Text>\n  <Input placeholder=\"Your name\" />\n  <Input placeholder=\"Your email\" type=\"email\" />\n  <Button type=\"primary\">Submit</Button>\n</FlexColumn>"
  }
} as const;

export const FlexColumnExamples: React.FC = () => {
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    gap: config.dynamicProps.gap?.default || 'md',
    align: config.dynamicProps.align?.default || 'start',
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
          <div key={index} className="flex flex-col gap-2 p-3 min-h-[160px]">
            <FlexColumn
              {...example.props}
              {...dynamicProps}
              className="h-32 w-full"
            >
              {Array.isArray(example.children)
                ? example.children.map((child, childIndex) => (
                    <div key={childIndex} className="bg-accent-500 text-white px-2 py-1 rounded text-xs font-medium text-center min-h-[24px] flex items-center justify-center">
                      {child}
                    </div>
                  ))
                : (
                    <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs font-medium text-center min-h-[24px] flex items-center justify-center">
                      {example.children}
                    </div>
                  )
              }
            </FlexColumn>
            <span className="text-xs text-subtle text-center">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};