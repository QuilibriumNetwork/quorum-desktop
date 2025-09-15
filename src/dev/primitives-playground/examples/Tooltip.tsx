import React from 'react';
import { Tooltip, Button, FlexRow } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const TooltipExamples: React.FC = () => {
  const config = primitivesConfig.tooltip;

  // Define all tooltip placements
  const placements = [
    { id: 'top', place: 'top', label: 'T' },
    { id: 'right', place: 'right', label: 'R' },
    { id: 'bottom', place: 'bottom', label: 'B' },
    { id: 'left', place: 'left', label: 'L' },
  ] as const;

  return (
    <div id={config.id}>
      <ExampleBox
        title={config.title}
        description={config.description}
        columns={config.columns as 1 | 2 | 3 | 4}
        background={config.background as any}
        dynamicProps={null}
        onDynamicPropsChange={null}
        notes={{
          quickTips: config.quickTips,
          codeExample: config.codeExample,
        }}
      >
        {/* First row: Basic, Custom Width, and Bordered examples */}
        <div className="w-full">
          <FlexRow justify="center" gap="xl" className="mb-8">
            {config.staticExamples.map((example, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <Tooltip {...example.props}>
                  <Button type="secondary" size="normal">
                    {example.children}
                  </Button>
                </Tooltip>
                <span className="text-xs text-subtle">
                  {example.name}
                </span>
              </div>
            ))}
          </FlexRow>

          {/* Second row: 4 positioning examples */}
          <div className="border-t border-surface-3 pt-6">
            <div className="text-center mb-4">
              <span className="text-xs text-subtle">Tooltip Positions</span>
            </div>
            <FlexRow justify="center" gap="lg">
              {placements.map((placement) => (
                <Tooltip
                  key={placement.id}
                  id={placement.id}
                  content={`Position: ${placement.place}`}
                  place={placement.place as any}
                >
                  <Button type="subtle" size="small">
                    {placement.label}
                  </Button>
                </Tooltip>
              ))}
            </FlexRow>
          </div>
        </div>
      </ExampleBox>
    </div>
  );
};