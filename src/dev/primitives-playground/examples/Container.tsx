import React, { useState } from 'react';
import { Container } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: "container-primitive",
  title: "Container",
  description: "Cross-platform container with padding and layout control",
  background: "surface-1",
  columns: 1,
  dynamicProps: {
    padding: {
      type: "select",
      options: ["none", "xs", "sm", "md", "lg", "xl"],
      default: "md",
      label: "Padding"
    },
    maxWidth: {
      type: "select",
      options: ["none", "sm", "md", "lg", "xl", "full"],
      default: "none",
      label: "Max Width"
    }
  },
  staticExamples: [
    { name: "Basic Container", props: {}, children: "This content is wrapped in a container. Use the controls above to adjust padding and max width to see how the container adapts." }
  ],
  quickTips: [
    "Use padding prop for consistent spacing",
    "maxWidth controls responsive container width",
    "centered prop centers content horizontally",
    "fullWidth removes max-width constraints"
  ],
  codeExample: {
    title: "Page Layout",
    code: "import { Container } from '@/components/primitives';\n\n<Container padding=\"lg\" maxWidth=\"md\" centered>\n  <h1 className=\"text-xl font-semibold\">Page Title</h1>\n  <p>Your page content goes here...</p>\n</Container>"
  }
} as const;

export const ContainerExamples: React.FC = () => {
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
                <p className="text-sm">{example.children}</p>
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