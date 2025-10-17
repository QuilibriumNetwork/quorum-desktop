import React from 'react';
import { Button } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';
import { showSuccess, showError, showWarning, showInfo } from '../../../utils/toast';

export const ToastExample: React.FC = () => {
  const config = primitivesConfig.toast;

  // Handler functions for each static example
  const handleToastClick = (variant: 'success' | 'error' | 'warning' | 'info', message: string) => {
    switch (variant) {
      case 'success':
        showSuccess(message);
        break;
      case 'error':
        showError(message);
        break;
      case 'warning':
        showWarning(message);
        break;
      case 'info':
        showInfo(message);
        break;
    }
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
        {config.staticExamples.map((example, index) => (
          <div key={index} className="flex flex-col items-center gap-2 p-3">
            <Button
              type="secondary"
              size="small"
              onClick={() => handleToastClick(
                example.props.variant as 'success' | 'error' | 'warning' | 'info',
                example.props.message
              )}
            >
              {example.name}
            </Button>
            <span className="text-xs text-subtle">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};
