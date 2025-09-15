import React, { useState } from 'react';
import { Select } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const SelectExamples: React.FC = () => {
  const config = primitivesConfig.select;
  const [selectValues, setSelectValues] = useState<Record<string, string>>({});
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'medium',
  });

  const handleSelectChange = (index: number, value: string) => {
    setSelectValues(prev => ({
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
            <Select
              {...example.props}
              {...dynamicProps}
              value={selectValues[index] || example.props.defaultValue || ''}
              onChange={(value) => handleSelectChange(index, value)}
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