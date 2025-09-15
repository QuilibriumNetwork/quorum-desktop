import React, { useState } from 'react';
import { Container, Text } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const ContainerExamples: React.FC = () => {
  const config = primitivesConfig.container;
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    padding: config.dynamicProps.padding?.default || 'md',
    maxWidth: config.dynamicProps.maxWidth?.default || 'none',
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
          <div key={index} className="flex flex-col gap-2 p-3">
            <div className="border border-surface-4 rounded bg-surface-0 min-h-[120px]">
              <Container
                {...example.props}
                {...dynamicProps}
              >
                <Text size="sm">{example.children}</Text>
              </Container>
            </div>
            <span className="text-xs text-subtle text-center">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};