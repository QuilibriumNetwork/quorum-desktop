import React, { useState } from 'react';
import { Input, Icon, FlexRow } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const InputExamples: React.FC = () => {
  const config = primitivesConfig.input;
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

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
        {config.staticExamples.map((example, index) => {
          // Special handling for minimal search example
          if (example.name === 'Minimal Search') {
            const isFocused = focusedIndex === index;
            return (
              <div key={index} className="flex flex-col gap-2 p-3">
                <div
                  className="flex items-center gap-2"
                  style={{
                    borderBottom: `1px solid var(--color-field-border${isFocused ? '-focus' : ''})`,
                    paddingBottom: '0',
                    transition: 'border-color 0.15s ease-in-out',
                    alignItems: 'center'
                  }}
                >
                  <Icon
                    name="search"
                    size="sm"
                    className={isFocused ? "text-accent" : "text-subtle"}
                    style={{ transition: 'color 0.15s ease-in-out', marginBottom: '2px' }}
                  />
                  <Input
                    {...example.props}
                    value={inputValues[index] || ''}
                    onChange={(value) => handleInputChange(index, value)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    className="flex-1"
                    style={{ border: 'none', borderBottom: 'none' }}
                  />
                </div>
                <span className="text-xs text-subtle">
                  {example.name}
                </span>
              </div>
            );
          }

          // Default rendering for other examples
          return (
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
          );
        })}
      </ExampleBox>
    </div>
  );
};