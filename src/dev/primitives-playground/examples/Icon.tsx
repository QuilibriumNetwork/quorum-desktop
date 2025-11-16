import React, { useState } from 'react';
import { Icon } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import { IconGallery } from './IconGallery';

const config = {
  id: "icon-primitive",
  title: "Icon",
  description: "Cross-platform icon component using Tabler Icons (outline & filled variants)",
  background: "modal",
  columns: 4,
  dynamicProps: {
    size: {
      type: "select",
      options: ["xs", "sm", "md", "lg", "xl", "2xl"],
      default: "md",
      label: "Size"
    }
  },
  staticExamples: [
    { name: "home", props: { name: "home", variant: "outline" }, children: null },
    { name: "settings", props: { name: "settings", variant: "outline" }, children: null },
    { name: "user", props: { name: "user", variant: "outline" }, children: null },
    { name: "search", props: { name: "search", variant: "outline" }, children: null },
    { name: "plus", props: { name: "plus", variant: "outline" }, children: null },
    { name: "close", props: { name: "close", variant: "outline" }, children: null },
    { name: "check", props: { name: "check", variant: "outline" }, children: null },
    { name: "arrow-right", props: { name: "arrow-right", variant: "outline" }, children: null },
    { name: "heart (filled)", props: { name: "heart", variant: "filled" }, children: null },
    { name: "star (filled)", props: { name: "star", variant: "filled" }, children: null },
    { name: "bell", props: { name: "bell", variant: "outline" }, children: null },
    { name: "circle (filled)", props: { name: "circle", variant: "filled" }, children: null },
    { name: "lock", props: { name: "lock", variant: "outline" }, children: null },
    { name: "eye", props: { name: "eye", variant: "outline" }, children: null },
    { name: "bookmark (filled)", props: { name: "bookmark", variant: "filled" }, children: null },
    { name: "square (filled)", props: { name: "square", variant: "filled" }, children: null }
  ],
  quickTips: [
    "Use semantic icon names that match Tabler icons",
    "Size should match surrounding text for inline usage",
    "Use consistent icon sizing throughout your app",
    "Only some icons support variant='filled' (heart, star, circle, square, bookmark, etc.)",
    "Icons default to 'outline' variant - specify 'filled' only when available",
    "Colors are controlled via CSS classes or color prop"
  ],
  codeExample: {
    title: "Icon Usage",
    code: "import { Icon } from '@/components/primitives';\n\n// Outline icons (default)\n<Icon name=\"settings\" size=\"md\" />\n<Icon name=\"check\" size=\"sm\" className=\"text-success\" />\n<Icon name=\"close\" size=\"lg\" color=\"red\" />\n\n// Filled variants (only for supported icons)\n<Icon name=\"star\" size=\"xl\" variant=\"filled\" />\n<Icon name=\"heart\" size=\"lg\" variant=\"filled\" color=\"red\" />\n<Icon name=\"circle\" size=\"md\" variant=\"filled\" />\n<Icon name=\"square\" size=\"sm\" variant=\"filled\" />\n\n// Colors and sizing\n<Icon name=\"home\" size=\"2xl\" className=\"text-accent\" />"
  }
} as const;

export const IconExamples: React.FC = () => {
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'md',
  });
  const [showGallery, setShowGallery] = useState(false);

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
            <Icon
              {...example.props}
              {...dynamicProps}
            />
            <span className="text-xs text-subtle">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>

      {/* Icon Gallery Dropdown */}
      <div className="mt-4">
        <button
          onClick={() => setShowGallery(!showGallery)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Icon name={showGallery ? 'chevron-up' : 'chevron-down'} size="sm" color="white" />
          {showGallery ? 'Hide' : 'Show'} Full Icon Set
        </button>

        {showGallery && (
          <div className="mt-4">
            <IconGallery />
          </div>
        )}
      </div>
    </div>
  );
};