import { logger } from '@quilibrium/quorum-shared';
import React, { useState } from 'react';
import { Input, Icon, FlexRow } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

export const InputExamples: React.FC = () => {
  const config = {
    id: "input-primitive",
    title: "Input",
    description: "Cross-platform text input component",
    background: "modal",
    columns: 3,
    dynamicProps: {},
    staticExamples: [
      { name: "Default (Filled)", props: { placeholder: "Enter text...", variant: "filled" }, children: null },
      { name: "Bordered", props: { placeholder: "Bordered input", variant: "bordered" }, children: null },
      { name: "Minimal Search", props: { placeholder: "Search something...", variant: "minimal", type: "search" }, children: null },
      { name: "Email Type", props: { placeholder: "email@example.com", type: "email" }, children: null },
      { name: "Password", props: { placeholder: "Password", type: "password" }, children: null },
      { name: "With Error", props: { placeholder: "Invalid input", error: true, errorMessage: "This field is required" }, children: null },
      { name: "Disabled", props: { placeholder: "Disabled input", disabled: true }, children: null }
    ],
    quickTips: [
      "Use variant='bordered' for forms on light backgrounds",
      "Always provide clear placeholder text",
      "Use appropriate input types (email, password, number)",
      "Show error states with clear messages"
    ],
    codeExample: {
      title: "All Input Props",
      code: "import { Input } from '@/components/primitives';\n\n<Input\n  // Core props\n  value={inputValue}\n  onChange={setInputValue}\n  placeholder=\"Enter text...\"\n  \n  // Variants\n  variant=\"filled\" // 'filled' | 'bordered' | 'minimal' | 'onboarding'\n  \n  // Input types\n  type=\"text\" // 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'\n  \n  // States\n  disabled={false}\n  autoFocus={false}\n  noFocusStyle={false}\n  \n  // Error handling\n  error={hasError}\n  errorMessage=\"This field is required\"\n  \n  // Labels\n  label=\"Field Label\"\n  labelType=\"static\" // 'static' | 'floating'\n  required={true}\n  helperText=\"Additional help text\"\n  \n  // Event handlers\n  onFocus={() => logger.log('focused')}\n  onBlur={() => logger.log('blurred')}\n  onKeyDown={(e) => logger.log('key:', e.key)}\n  \n  // Styling\n  className=\"custom-class\"\n  style={{ width: '100%' }}\n  \n  // Accessibility\n  testID=\"input-test-id\"\n  accessibilityLabel=\"Accessible label\"\n/>"
    }
  } as const;
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const handleInputChange = (index: number, value: string) => {
    setInputValues(prev => ({
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
        {config.staticExamples.map((example, index) => {
          // Special handling for minimal search example
          if (example.name === 'Minimal Search') {
            const isFocused = focusedIndex === index;
            return (
              <div key={index} className="flex flex-col gap-2 p-3">
                <div
                  className="flex items-center gap-2"
                  style={{
                    borderBottom: `1px solid var(--color-field-border${isFocused ? '-focus' : ''})`,
                    paddingBottom: '0',
                    transition: 'border-color 0.15s ease-in-out',
                    alignItems: 'center'
                  }}
                >
                  <Icon
                    name="search"
                    size="sm"
                    className={isFocused ? "text-accent" : "text-subtle"}
                    style={{ transition: 'color 0.15s ease-in-out', marginBottom: '2px' }}
                  />
                  <Input
                    {...example.props}
                    value={inputValues[index] || ''}
                    onChange={(value) => handleInputChange(index, value)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    className="flex-1"
                    style={{ border: 'none', borderBottom: 'none' }}
                  />
                </div>
                <span className="text-xs text-subtle">
                  {example.name}
                </span>
              </div>
            );
          }

          // Default rendering for other examples
          return (
            <div key={index} className="flex flex-col gap-2 p-3">
              <Input
                {...example.props}
                value={inputValues[index] || ''}
                onChange={(value) => handleInputChange(index, value)}
              />
              <span className="text-xs text-subtle">
                {example.name}
              </span>
            </div>
          );
        })}
      </ExampleBox>
    </div>
  );
};
