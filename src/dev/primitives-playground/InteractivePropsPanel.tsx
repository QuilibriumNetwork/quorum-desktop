import React, { useState, useEffect } from 'react';
import { Flex, Button, Select } from '@/components/primitives';

interface PropConfig {
  type: 'select' | 'boolean' | 'number';
  options?: string[] | number[];
  default: any;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}

interface InteractivePropsPanelProps {
  dynamicProps: Record<string, PropConfig>;
  onChange: (props: Record<string, any>) => void;
}

export const InteractivePropsPanel: React.FC<InteractivePropsPanelProps> = ({
  dynamicProps,
  onChange,
}) => {
  // Initialize current values with defaults
  const [currentValues, setCurrentValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    Object.entries(dynamicProps).forEach(([key, config]) => {
      initial[key] = config.default;
    });
    return initial;
  });

  // Notify parent of changes
  useEffect(() => {
    onChange(currentValues);
  }, [currentValues, onChange]);

  const handleValueChange = (propName: string, value: any) => {
    setCurrentValues(prev => ({
      ...prev,
      [propName]: value
    }));
  };

  const resetToDefaults = () => {
    const defaults: Record<string, any> = {};
    Object.entries(dynamicProps).forEach(([key, config]) => {
      defaults[key] = config.default;
    });
    setCurrentValues(defaults);
  };

  const [showCopied, setShowCopied] = useState(false);

  const copyCurrentProps = () => {
    const propsString = Object.entries(currentValues)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');

    navigator.clipboard.writeText(propsString).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    });
  };

  return (
    <Flex direction="column" gap="md">
      <Flex justify="between" align="center">
        <span className="text-sm font-semibold">Interactive Properties</span>
        <Flex gap="xs">
          <Button type="subtle" size="small" onClick={copyCurrentProps}>
            {showCopied ? 'Copied!' : 'Copy Props'}
          </Button>
          <Button type="subtle-outline" size="small" onClick={resetToDefaults}>
            Reset
          </Button>
        </Flex>
      </Flex>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(dynamicProps).map(([propName, config]) => (
          <Flex direction="column" key={propName} gap="xs">
            <span className="text-sm text-subtle">{config.label}</span>

            {config.type === 'select' && config.options && (
              <Select
                value={currentValues[propName]}
                variant="bordered"
                onChange={(value) => handleValueChange(propName, value)}
                options={config.options.map(option => ({
                  label: String(option),
                  value: option
                }))}
              />
            )}

            {config.type === 'boolean' && (
              <Flex gap="xs">
                <Button
                  type={currentValues[propName] === false ? "primary" : "light"}
                  size="small"
                  onClick={() => handleValueChange(propName, false)}
                >
                  False
                </Button>
                <Button
                  type={currentValues[propName] === true ? "primary" : "light"}
                  size="small"
                  onClick={() => handleValueChange(propName, true)}
                >
                  True
                </Button>
              </Flex>
            )}

            {config.type === 'number' && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={config.min || 0}
                  max={config.max || 100}
                  step={config.step || 1}
                  value={currentValues[propName]}
                  onChange={(e) => handleValueChange(propName, Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-subtle w-8 text-center">
                  {currentValues[propName]}
                </span>
              </div>
            )}
          </Flex>
        ))}
      </div>

      {/* Current Props Display */}
      <div>
        <pre className="text-xs text-subtle overflow-x-auto">
          <code>
            Current Props: {Object.entries(currentValues)
              .map(([key, value]) => `${key}="${value}"`)
              .join(' ')}
          </code>
        </pre>
      </div>
    </Flex>
  );
};