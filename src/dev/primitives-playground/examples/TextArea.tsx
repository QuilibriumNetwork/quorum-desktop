import React, { useState } from 'react';
import { TextArea } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: "textarea-primitive",
  title: "TextArea",
  description: "Cross-platform multi-line text input component",
  background: "modal",
  columns: 2,
  dynamicProps: {},
  staticExamples: [
    { name: "Basic TextArea", props: { placeholder: "Enter your message...", rows: 4 }, children: null },
    { name: "With Value", props: { value: "This is some sample text content that spans multiple lines and demonstrates the textarea component.", rows: 3 }, children: null },
    { name: "Disabled", props: { disabled: true, placeholder: "This textarea is disabled", rows: 3 }, children: null },
    { name: "With Error", props: { error: true, errorMessage: "Message must be at least 10 characters", placeholder: "Enter your message...", rows: 4 }, children: null }
  ],
  quickTips: [
    "Set appropriate rows for expected content length",
    "Use clear placeholder text",
    "Implement character counting for limits",
    "Show error states with helpful messages"
  ],
  codeExample: {
    title: "Feedback Form",
    code: "import { TextArea } from '@/components/primitives';\n\n<TextArea\n  value={feedback}\n  onChange={setFeedback}\n  placeholder=\"Share your feedback...\"\n  rows={6}\n  error={!!feedbackError}\n  errorMessage={feedbackError}\n/>"
  }
} as const;

export const TextAreaExamples: React.FC = () => {
  const [textAreaValues, setTextAreaValues] = useState<Record<string, string>>({});

  const handleTextAreaChange = (index: number, value: string) => {
    setTextAreaValues(prev => ({
      ...prev,
      [index]: value
    }));
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
          <div key={index} className="flex flex-col gap-2 p-3">
            <TextArea
              {...example.props}
              value={textAreaValues[index] || ('value' in example.props ? example.props.value : '') || ''}
              onChange={(value) => handleTextAreaChange(index, value)}
            />
            <span className="text-xs text-subtle">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};