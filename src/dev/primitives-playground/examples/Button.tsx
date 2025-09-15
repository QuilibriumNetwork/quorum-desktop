import React, { useState } from 'react';
import { Button } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const ButtonExamples: React.FC = () => {
  const config = primitivesConfig.button;
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'normal',
  });

  const handleClick = () => {
    console.log('Button clicked!');
  };

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
            <Button
              {...example.props}
              {...dynamicProps}
              onClick={handleClick}
            >
              {example.children}
            </Button>
            <span className="text-xs text-subtle">
              type="{example.props.type}"
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};