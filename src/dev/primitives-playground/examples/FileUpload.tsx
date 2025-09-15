import React, { useState } from 'react';
import { FileUpload, Text, Icon } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const FileUploadExamples: React.FC = () => {
  const config = primitivesConfig.fileupload;
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    multiple: config.dynamicProps.multiple?.default || false,
  });
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, string[]>>({});

  const handleFilesSelected = (index: number, files: any[]) => {
    setUploadedFiles(prev => ({
      ...prev,
      [index]: files.map(f => f.name)
    }));
  };

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
          <div key={index} className="flex flex-col gap-2 p-3">
            <FileUpload
              {...example.props}
              multiple={index === 1 ? true : dynamicProps.multiple}
              onFilesSelected={(files) => handleFilesSelected(index, files)}
            >
              <div className="border-2 border-dashed border-surface-4 rounded-lg p-6 text-center hover:border-accent-500 transition-colors cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <Icon name="upload" size="lg" className="text-subtle" />
                  <Text size="sm" variant="subtle">
                    {example.children}
                  </Text>
                </div>
              </div>
            </FileUpload>
            {uploadedFiles[index] && (
              <div className="mt-2">
                <Text size="xs" variant="subtle">
                  Uploaded: {uploadedFiles[index].join(', ')}
                </Text>
              </div>
            )}
            <span className="text-xs text-subtle text-center">
              {example.name}
            </span>
          </div>
        ))}
      </ExampleBox>
    </div>
  );
};