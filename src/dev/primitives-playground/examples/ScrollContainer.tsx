import React, { useState } from 'react';
import { ScrollContainer, Text } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const ScrollContainerExamples: React.FC = () => {
  const config = primitivesConfig.scrollcontainer;
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    height: config.dynamicProps.height?.default || 'md',
  });

  // First example: title and paragraph content
  const articleContent = (
    <div className="p-4 space-y-4">
      <div>
        <Text size="lg" variant="strong">Understanding ScrollContainer</Text>
      </div>
      <Text size="sm">
        The ScrollContainer component is designed to handle long content that exceeds the available space.
        It automatically provides scrollbars when content overflows, making it perfect for constrained layouts.
      </Text>
      <Text size="sm">
        This example demonstrates how text content flows within a ScrollContainer. You can adjust the height
        using the controls above to see how the scrolling behavior adapts to different container sizes.
      </Text>
      <Text size="sm">
        The component supports various height presets (xs, sm, md, lg, xl) and can also accept custom
        height values. It maintains consistent styling across both web and mobile platforms.
      </Text>
      <Text size="sm">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
        labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.
      </Text>
      <Text size="sm">
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
        Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
      </Text>
    </div>
  );

  // Second example: extensive list content for scrolling demonstration
  const extensiveListContent = Array.from({ length: 50 }, (_, i) => (
    <div key={i} className="py-3 px-4 border-b border-surface-3 last:border-b-0 hover:bg-surface-1 transition-colors">
      <Text size="sm" variant="strong">Section {i + 1}</Text>
      <Text size="xs" variant="subtle">
        Detailed content for section {i + 1}. This demonstrates scrollable list behavior with many items.
      </Text>
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