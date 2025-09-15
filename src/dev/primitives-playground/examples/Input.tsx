import React, { useState } from 'react';
import { Input } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const InputExamples: React.FC = () => {
  const config = primitivesConfig.input;
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const handleInputChange = (index: number, value: string) => {
    setInputValues(prev => ({
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
        notes={{
          quickTips: config.quickTips,
          codeExample: config.codeExample,
        }}
      >
        {config.staticExamples.map((example, index) => (
          <div key={index} className="flex flex-col gap-2 p-3">
            <Input
              {...example.props}
              value={inputValues[index] || ''}
              onChange={(value) => handleInputChange(index, value)}
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