import React, { useState } from 'react';
import { Text } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const TextExamples: React.FC = () => {
  const config = primitivesConfig.text;
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'base',
    weight: config.dynamicProps.weight?.default || 'normal',
    align: config.dynamicProps.align?.default || 'left',
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
          <div key={index} className="flex flex-col gap-2 p-3 min-h-[60px] justify-center">
            <Text
              {...example.props}
              {...dynamicProps}
            >
              {example.children}
            </Text>
            <span className="text-xs text-subtle">
              variant="{example.props.variant}"
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};