import React, { useState } from 'react';
import { FlexRow, Text } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: "flex-primitives",
  title: "FlexRow",
  description: "Horizontal flex layout container",
  background: "surface-1",
  columns: 1,
  dynamicProps: {
    gap: {
      type: "select",
      options: ["none", "xs", "sm", "md", "lg", "xl"],
      default: "md",
      label: "Gap"
    },
    justify: {
      type: "select",
      options: ["start", "end", "center", "between", "around", "evenly"],
      default: "center",
      label: "Justify"
    },
    align: {
      type: "select",
      options: ["start", "end", "center", "stretch", "baseline"],
      default: "center",
      label: "Align"
    }
  },
  staticExamples: [
    { name: "Four Items", props: {}, children: ["Home", "About", "Services", "Contact"] }
  ],
  quickTips: [
    "Use gap prop instead of manual spacing",
    "justify controls horizontal distribution",
    "align controls vertical alignment",
    "wrap=true allows items to flow to next line"
  ],
  codeExample: {
    title: "Header Layout",
    code: "import { FlexRow, Text, Button } from '@/components/primitives';\n\n<FlexRow justify=\"between\" align=\"center\">\n  <Text variant=\"strong\">Page Title</Text>\n  <Button type=\"primary\">Action</Button>\n</FlexRow>"
  }
} as const;

export const FlexRowExamples: React.FC = () => {
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    gap: config.dynamicProps.gap?.default || 'md',
    justify: config.dynamicProps.justify?.default || 'center',
    align: config.dynamicProps.align?.default || 'center',
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
          <div key={index} className="flex flex-col gap-2 p-3 min-h-[120px]">
            <FlexRow
              {...example.props}
              {...dynamicProps}
              className="h-20 w-full min-w-[300px]"
            >
              {Array.isArray(example.children)
                ? example.children.map((child, childIndex) => (
                    <div key={childIndex} className="bg-accent-500 text-white px-1 py-1 rounded text-xs font-medium flex-shrink-0 min-w-[20px] text-center">
                      {child}
                    </div>
                  ))
                : (
                    <div className="bg-accent-500 text-white px-1 py-1 rounded text-xs font-medium flex-shrink-0 min-w-[20px] text-center">
                      {example.children}
                    </div>
                  )
              }
            </FlexRow>
            <span className="text-xs text-subtle text-center">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};