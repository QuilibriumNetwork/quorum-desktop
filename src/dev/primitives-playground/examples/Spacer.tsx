import React, { useState } from 'react';
import { Spacer, FlexColumn, FlexRow } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const SpacerExamples: React.FC = () => {
  const config = primitivesConfig.spacer;
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
                <FlexRow className="h-full w-full" align="center" justify="center">
                  <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs text-center">
                    Item 1
                  </div>
                  <Spacer {...example.props} size={dynamicProps.size} />
                  <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs text-center">
                    Item 2
                  </div>
                </FlexRow>
              )}
              {/* Vertical Spacing - 3 items */}
              {index === 1 && (
                <FlexColumn className="h-full w-full" align="center" justify="center">
                  <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs text-center">
                    Item A
                  </div>
                  <Spacer {...example.props} size={dynamicProps.size} />
                  <div className="bg-accent-500 text-white px-2 py-1 rounded text-xs text-center">
                    Item B
                  </div>
                </FlexColumn>
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