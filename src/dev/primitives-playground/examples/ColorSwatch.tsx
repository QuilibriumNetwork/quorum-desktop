import React, { useState } from 'react';
import { ColorSwatch, FlexRow } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const ColorSwatchExamples: React.FC = () => {
  const config = primitivesConfig.colorswatch;
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'medium',
  });
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

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
            <ColorSwatch
              {...example.props}
              size={dynamicProps.size}
              onPress={() => {
                if (!example.props.disabled) {
                  setSelectedColor(example.props.color);
                }
              }}
              isActive={selectedColor === example.props.color}
            />
            <span className="text-xs text-subtle text-center">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};