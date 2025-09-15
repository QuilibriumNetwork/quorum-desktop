import React, { useState } from 'react';
import { Callout } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const CalloutExamples: React.FC = () => {
  const config = primitivesConfig.callout;

  return (
    <div id={config.id}>
      <ExampleBox
        title={config.title}
        description={config.description}
        columns={config.columns as 1 | 2 | 3 | 4}
        background={config.background as any}
        notes={{
          quickTips: config.quickTips,
          codeExample: config.codeExample,
        }}
      >
        {config.staticExamples.map((example, index) => (
          <div key={index} className="flex flex-col gap-2 p-3">
            <Callout
              {...example.props}
            >
              {example.children}
            </Callout>
            <span className="text-xs text-subtle">
              variant="{example.props.variant}"
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};