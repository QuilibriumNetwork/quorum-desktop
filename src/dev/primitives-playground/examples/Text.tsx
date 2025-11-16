import React, { useState } from 'react';
import { Text } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const textConfig = {
  id: "text-primitive",
  title: "Text",
  description: "Cross-platform text component with semantic variants",
  background: "chat",
  columns: 3,
  dynamicProps: {
    size: {
      type: "select",
      options: ["xs", "sm", "base", "lg", "xl", "2xl", "3xl"],
      default: "base",
      label: "Size"
    },
    weight: {
      type: "select",
      options: ["normal", "medium", "semibold", "bold"],
      default: "normal",
      label: "Weight"
    },
    align: {
      type: "select",
      options: ["left", "center", "right"],
      default: "left",
      label: "Align"
    }
  },
  staticExamples: [
    { name: "Default", props: { variant: "default" }, children: "Default text style" },
    { name: "Strong", props: { variant: "strong" }, children: "Strong emphasized text" },
    { name: "Subtle", props: { variant: "subtle" }, children: "Subtle secondary text" },
    { name: "Muted", props: { variant: "muted" }, children: "Muted disabled text" },
    { name: "Error", props: { variant: "error" }, children: "Error message text" },
    { name: "Success", props: { variant: "success" }, children: "Success message text" },
    { name: "Warning", props: { variant: "warning" }, children: "Warning message text" },
    { name: "Link Style", props: { variant: "link" }, children: "Link styled text" }
  ],
  quickTips: [
    "Use variant='strong' for headings and emphasis",
    "variant='subtle' for secondary information",
    "variant='muted' for disabled or less important text",
    "Combine size and weight props for custom hierarchy"
  ]
} as const;

const typographyConfig = {
  staticExamples: [
    { name: "Title Large", props: { typography: "title-large" }, children: "Title Large" },
    { name: "Title", props: { typography: "title" }, children: "Title" },
    { name: "Subtitle", props: { typography: "subtitle" }, children: "Subtitle" },
    { name: "Subtitle 2", props: { typography: "subtitle-2" }, children: "Subtitle 2" },
    { name: "Body", props: { typography: "body" }, children: "Body Text" },
    { name: "Body + Subtle", props: { typography: "body", variant: "subtle" }, children: "Body Subtle" },
    { name: "Label", props: { typography: "label" }, children: "Label" },
    { name: "Label Strong", props: { typography: "label-strong" }, children: "Label Strong" },
    { name: "Small", props: { typography: "small" }, children: "Small Text" },
    { name: "Small Desktop", props: { typography: "small-desktop" }, children: "Small Desktop" }
  ],
  quickTips: [
    "typography prop sets size/weight/line-height semantically",
    "Use variant prop to override color: <Text typography=\"body\" variant=\"subtle\">",
    "Works identically on web and native",
    "No className conflicts - clean semantic styling",
    "Color priority: color prop > variant > typography default",
    "Use typography='body' for main content text",
    "Use typography='title' for modal/section headers",
    "Use typography='label-strong' for form labels"
  ]
} as const;

export const TextExamples: React.FC = () => {
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: textConfig.dynamicProps.size?.default || 'base',
    weight: textConfig.dynamicProps.weight?.default || 'normal',
    align: textConfig.dynamicProps.align?.default || 'left',
  });

  // Combine all examples
  const allExamples = [
    ...typographyConfig.staticExamples.map(ex => ({ ...ex, section: 'typography' })),
    ...textConfig.staticExamples.map(ex => ({ ...ex, section: 'legacy' })),
  ];

  // Combine quick tips
  const combinedQuickTips = [
    '🆕 Typography Prop (Recommended for Cross-Platform):',
    ...typographyConfig.quickTips,
    '',
    '📦 Legacy Props (Backwards Compatible):',
    ...textConfig.quickTips,
  ];

  return (
    <div id={textConfig.id}>
      <ExampleBox
        title={textConfig.title}
        description="Cross-platform text component with semantic typography prop (NEW) and legacy variant/size/weight props"
        columns={3}
        background={textConfig.background as any}
        dynamicProps={textConfig.dynamicProps}
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
                ? `typography="${'typography' in example.props ? example.props.typography : ''}"`
                : `variant="${'variant' in example.props ? example.props.variant : ''}"`}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};