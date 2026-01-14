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
    "Combine size and weight props for custom hierarchy",
    "For web-only code, prefer plain HTML with CSS classes:",
    "  <p className=\"text-body\">Body text</p>",
    "  <span className=\"text-small text-subtle\">Helper text</span>"
  ]
} as const;

export const TextExamples: React.FC = () => {
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: textConfig.dynamicProps.size?.default || 'base',
    weight: textConfig.dynamicProps.weight?.default || 'normal',
    align: textConfig.dynamicProps.align?.default || 'left',
  });

  return (
    <div id={textConfig.id}>
      <ExampleBox
        title={textConfig.title}
        description={textConfig.description}
        columns={3}
        background={textConfig.background as any}
        dynamicProps={textConfig.dynamicProps}
        onDynamicPropsChange={setDynamicProps}
        notes={{
          quickTips: textConfig.quickTips,
          codeExample: {
            title: 'Text Primitive vs CSS Classes',
            code: `import { Text } from '@/components/primitives';

// Text primitive (cross-platform)
<Text variant="strong" size="lg" weight="semibold">
  Heading text
</Text>
<Text variant="subtle">Secondary information</Text>

// Plain HTML + CSS classes (web-only, simpler)
<p className="text-body">Main content text</p>
<span className="text-small text-subtle">Helper text</span>
<h1 className="text-title">Page title</h1>

// Available CSS typography classes:
// text-title-large, text-title, text-subtitle, text-subtitle-2
// text-body, text-label, text-label-strong
// text-small, text-small-desktop

// Color classes: text-strong, text-subtle, text-muted, etc.`,
          },
        }}
      >
        {textConfig.staticExamples.map((example, index) => (
          <div key={index} className="flex flex-col gap-2 p-3 min-h-[60px] justify-center">
            <Text
              {...example.props}
              {...dynamicProps}
            >
              {example.children}
            </Text>
            <span className="text-xs text-subtle">
              variant="{example.props.variant}"
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};
