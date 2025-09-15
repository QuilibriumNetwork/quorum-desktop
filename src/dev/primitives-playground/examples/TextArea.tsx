import React, { useState } from 'react';
import { TextArea } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const TextAreaExamples: React.FC = () => {
  const config = primitivesConfig.textarea;
  const [textAreaValues, setTextAreaValues] = useState<Record<string, string>>({});

  const handleTextAreaChange = (index: number, value: string) => {
    setTextAreaValues(prev => ({
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
            <TextArea
              {...example.props}
              value={textAreaValues[index] || example.props.value || ''}
              onChange={(value) => handleTextAreaChange(index, value)}
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