import React, { useState } from 'react';
import { Switch } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const SwitchExamples: React.FC = () => {
  const config = primitivesConfig.switch;
  const [switchStates, setSwitchStates] = useState<Record<string, boolean>>({});
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'medium',
  });

  const handleSwitchChange = (index: number, value: boolean) => {
    setSwitchStates(prev => ({
      ...prev,
      [index]: value
    }));
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
          <div key={index} className="flex flex-col gap-2 p-3">
            <Switch
              {...example.props}
              {...dynamicProps}
              value={switchStates[index] ?? example.props.defaultValue}
              onChange={(value) => handleSwitchChange(index, value)}
            />
            <span className="text-xs text-subtle">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};