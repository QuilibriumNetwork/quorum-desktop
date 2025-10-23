import React, { useState } from 'react';
import { Icon } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import { IconGallery } from './IconGallery';
import primitivesConfig from '../primitivesConfig.json';

export const IconExamples: React.FC = () => {
  const config = primitivesConfig.icon;
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
        {config.staticExamples.map((example, index) => {
          // Make half the icons filled (every other one)
          const variant = index % 2 === 0 ? 'outline' : 'filled';
          const label = variant === 'filled' ? `${example.props.name} (filled)` : example.props.name;

          return (
            <div key={index} className="flex flex-col items-center gap-2 p-3">
              <Icon
                {...example.props}
                {...dynamicProps}
                variant={variant}
              />
              <span className="text-xs text-subtle">
                {label}
              </span>
            </div>
          );
        })}
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