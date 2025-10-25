import React, { useState } from 'react';
import { Text } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const TextExamples: React.FC = () => {
  const config = primitivesConfig.text;
  const typographyConfig = primitivesConfig['text-typography'];

  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'base',
    weight: config.dynamicProps.weight?.default || 'normal',
    align: config.dynamicProps.align?.default || 'left',
  });

  // Combine all examples
  const allExamples = [
    ...typographyConfig.staticExamples.map(ex => ({ ...ex, section: 'typography' })),
    ...config.staticExamples.map(ex => ({ ...ex, section: 'legacy' })),
  ];

  // Combine quick tips
  const combinedQuickTips = [
    '🆕 Typography Prop (Recommended for Cross-Platform):',
    ...typographyConfig.quickTips,
    '',
    '📦 Legacy Props (Backwards Compatible):',
    ...config.quickTips,
  ];

  return (
    <div id={config.id}>
      <ExampleBox
        title={config.title}
        description="Cross-platform text component with semantic typography prop (NEW) and legacy variant/size/weight props"
        columns={3}
        background={config.background as any}
        dynamicProps={config.dynamicProps}
        onDynamicPropsChange={setDynamicProps}
        notes={{
          quickTips: combinedQuickTips,
          codeExample: {
            title: 'Typography Prop (NEW) vs Legacy Props',
            code: `import { Text } from '@/components/primitives';\n\n// 🆕 NEW: Cross-platform semantic styling (Recommended)\n<Text typography="title">Modal Title</Text>\n<Text typography="body">Main content text</Text>\n<Text typography="label-strong">Form Label</Text>\n<Text typography="subtitle-2">Section Header</Text>\n\n// Color override with variant prop\n<Text typography="body" variant="subtle">Subtle body text</Text>\n<Text typography="title" variant="subtle">Subtle title</Text>\n\n// Typography values:\n// - title-large, title, subtitle, subtitle-2\n// - body, label, label-strong\n// - small, small-desktop\n\n// Color priority: color prop > variant > typography default\n\n// 📦 LEGACY: Still works but not cross-platform\n<Text variant="strong" size="lg" weight="semibold">\n  Legacy approach\n</Text>`,
          },
        }}
      >
        {allExamples.map((example, index) => (
          <div key={index} className="flex flex-col gap-2 p-3 min-h-[60px] justify-center">
            <Text
              {...example.props}
              {...(example.section === 'legacy' ? dynamicProps : {})}
            >
              {example.children}
            </Text>
            <span className="text-xs text-subtle">
              {example.section === 'typography'
                ? `typography="${example.props.typography}"`
                : `variant="${example.props.variant}"`}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};