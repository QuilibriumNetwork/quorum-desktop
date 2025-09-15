import React, { useState } from 'react';
import { Icon } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const IconExamples: React.FC = () => {
  const config = primitivesConfig.icon;
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
          <div key={index} className="flex flex-col items-center gap-2 p-3">
            <Icon
              {...example.props}
              {...dynamicProps}
            />
            <span className="text-xs text-subtle">
              name="{example.props.name}"
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};