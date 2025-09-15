import React, { useState } from 'react';
import { RadioGroup } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const RadioGroupExamples: React.FC = () => {
  const config = primitivesConfig.radiogroup;
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    direction: config.dynamicProps.direction?.default || 'vertical',
  });
  const [radioValues, setRadioValues] = useState<Record<string, string>>({});

  const handleRadioChange = (index: number, value: string) => {
    setRadioValues(prev => ({
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
            <RadioGroup
              {...example.props}
              {...dynamicProps}
              value={radioValues[index] || example.props.defaultValue || ''}
              onChange={(value) => handleRadioChange(index, value)}
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