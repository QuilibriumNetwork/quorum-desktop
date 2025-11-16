import React from 'react';
import { Button } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import { showSuccess, showError, showWarning, showInfo } from '../../../utils/toast';

export const ToastExample: React.FC = () => {
  const config = {
    id: "toast-primitive",
    title: "Toast",
    description: "Fire-and-forget notifications (one visible at a time)",
    background: "surface-1",
    columns: 4,
    staticExamples: [
      { name: "Success", props: { variant: "success", message: "Operation completed successfully!" } },
      { name: "Error", props: { variant: "error", message: "Something went wrong." } },
      { name: "Warning", props: { variant: "warning", message: "This action cannot be undone." } },
      { name: "Info", props: { variant: "info", message: "Settings saved locally." } },
      { name: "Auto-Dismiss", props: { variant: "info", message: "Auto-dismisses in 5 seconds" } },
      { name: "Manual Dismiss", props: { variant: "success", message: "Click X to dismiss (clears timer)" } },
      { name: "Keyboard Dismiss", props: { variant: "warning", message: "Press Escape to dismiss" } },
      { name: "Long Message", props: { variant: "error", message: "An unexpected error occurred while processing your request. Please check your connection." } }
    ],
    quickTips: [
      "Only ONE toast visible at a time (newest replaces old)",
      "Auto-dismisses after 5 seconds",
      "Manual dismiss (X button) or keyboard (Escape)",
      "Works anywhere - React components, services, utility functions",
      "No hooks required - simple fire-and-forget API",
      "Timer automatically cleaned up on dismiss (no memory leaks)"
    ],
    codeExample: {
      title: "Toast Usage",
      code: "import { showSuccess, showError, showWarning, showInfo } from '@/utils/toast';\n\n// Simple usage\nshowSuccess('Data saved!');\nshowError('Failed to load data');\nshowWarning('Unsaved changes');\nshowInfo('Tip: Use Ctrl+S to save');\n\n// In React components\nconst handleSave = async () => {\n  try {\n    await saveData();\n    showSuccess('Profile updated successfully');\n  } catch (error) {\n    showError(error.message);\n  }\n};\n\n// Works in services too (no hooks needed)\nclass MessageService {\n  handleKick(spaceName) {\n    showWarning(`You've been kicked from ${spaceName}`);\n  }\n}"
    }
  } as const;

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
