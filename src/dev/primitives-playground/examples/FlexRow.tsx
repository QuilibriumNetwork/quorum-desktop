import React, { useState } from 'react';
import { FlexRow, Text } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const FlexRowExamples: React.FC = () => {
  const config = primitivesConfig.flexrow;
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