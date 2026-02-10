import React, { useState } from 'react';
import { ScrollContainer } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: "scrollcontainer-primitive",
  title: "ScrollContainer",
  description: "Scrollable container with customizable height and styling",
  background: "modal",
  columns: 2,
  dynamicProps: {
    height: {
      type: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
      default: "md",
      label: "Height"
    }
  },
  staticExamples: [
    { name: "Article Content", props: {}, children: "Title and paragraph content" },
    { name: "Long List", props: {}, children: "Extensive list with 50 items" }
  ],
  quickTips: [
    "Use for long content in limited space",
    "Height can be preset or custom value",
    "Supports border and border radius",
    "Preserves scroll position by default"
  ],
  codeExample: {
    title: "Message List",
    code: "import { ScrollContainer } from '@/components/primitives';\n\n<ScrollContainer\n  height=\"lg\"\n  showBorder\n  borderRadius=\"md\"\n>\n  {messages.map(msg => (\n    <MessageItem key={msg.id} {...msg} />\n  ))}\n</ScrollContainer>"
  }
} as const;

export const ScrollContainerExamples: React.FC = () => {
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    height: config.dynamicProps.height?.default || 'md',
  });

  // First example: title and paragraph content
  const articleContent = (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Understanding ScrollContainer</h3>
      </div>
      <p className="text-sm">
        The ScrollContainer component is designed to handle long content that exceeds the available space.
        It automatically provides scrollbars when content overflows, making it perfect for constrained layouts.
      </p>
      <p className="text-sm">
        This example demonstrates how text content flows within a ScrollContainer. You can adjust the height
        using the controls above to see how the scrolling behavior adapts to different container sizes.
      </p>
      <p className="text-sm">
        The component supports various height presets (xs, sm, md, lg, xl) and can also accept custom
        height values. It maintains consistent styling across both web and mobile platforms.
      </p>
      <p className="text-sm">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
        labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.
      </p>
      <p className="text-sm">
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
        Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
      </p>
    </div>
  );

  // Second example: extensive list content for scrolling demonstration
  const extensiveListContent = Array.from({ length: 50 }, (_, i) => (
    <div key={i} className="py-3 px-4 border-b border-surface-3 last:border-b-0 hover:bg-surface-1 transition-colors">
      <span className="text-sm font-semibold">Section {i + 1}</span>
      <span className="text-xs text-subtle">
        Detailed content for section {i + 1}. This demonstrates scrollable list behavior with many items.
      </span>
    </div>
  ));

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
            <ScrollContainer
              {...example.props}
              height={dynamicProps.height}
              showBorder={index === 0 ? true : false}
              borderRadius={index === 0 ? "md" : undefined}
              className="bg-surface-1"
            >
              {index === 0 ? articleContent : extensiveListContent}
            </ScrollContainer>
            <span className="text-xs text-subtle text-center">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};