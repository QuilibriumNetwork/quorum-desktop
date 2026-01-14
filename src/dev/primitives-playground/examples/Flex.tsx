import React, { useState } from 'react';
import { Flex } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: "flex-primitive",
  title: "Flex",
  description: "Unified flex layout container with direction prop (replaces FlexRow, FlexColumn, FlexCenter, FlexBetween)",
  background: "surface-1",
  columns: 1,
  dynamicProps: {
    direction: {
      type: "select",
      options: ["row", "column"],
      default: "row",
      label: "Direction"
    },
    gap: {
      type: "select",
      options: ["none", "xs", "sm", "md", "lg", "xl"],
      default: "md",
      label: "Gap"
    },
    justify: {
      type: "select",
      options: ["start", "end", "center", "between", "around", "evenly"],
      default: "start",
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
    "direction='row' is default (like FlexRow)",
    "direction='column' for vertical layouts (like FlexColumn)",
    "Default align depends on direction: row->center, column->stretch",
    "justify='between' replaces FlexBetween",
    "justify='center' align='center' replaces FlexCenter"
  ],
  codeExample: {
    title: "Migration Examples",
    code: `// FlexRow -> Flex (direction="row" is default)
<FlexRow gap="md">       ->  <Flex gap="md">

// FlexColumn -> Flex direction="column"
<FlexColumn gap="md">    ->  <Flex direction="column" gap="md">

// FlexBetween -> Flex justify="between"
<FlexBetween>            ->  <Flex justify="between">

// FlexCenter -> Flex justify="center" align="center"
<FlexCenter>             ->  <Flex justify="center" align="center">`
  }
} as const;

export const FlexExamples: React.FC = () => {
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    direction: config.dynamicProps.direction?.default || 'row',
    gap: config.dynamicProps.gap?.default || 'md',
    justify: config.dynamicProps.justify?.default || 'start',
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
          <div key={index} className="flex flex-col gap-2 p-3 min-h-[200px]">
            <Flex
              {...example.props}
              {...dynamicProps}
              className={dynamicProps.direction === 'column' ? "min-h-[150px] w-full" : "h-20 w-full min-w-[300px]"}
            >
              {Array.isArray(example.children)
                ? example.children.map((child, childIndex) => (
                    <div key={childIndex} className="bg-accent-500 text-white px-2 py-1 rounded text-xs font-medium flex-shrink-0 min-w-[20px] text-center">
                      {child}
                    </div>
                  ))
                : (
                    <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs font-medium flex-shrink-0 min-w-[20px] text-center">
                      {example.children}
                    </div>
                  )
              }
            </Flex>
            <span className="text-xs text-subtle text-center">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};
