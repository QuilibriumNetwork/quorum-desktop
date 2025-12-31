import { logger } from '@quilibrium/quorum-shared';
import React, { useState } from 'react';
import { FileUpload, Text, Icon } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

const config = {
  id: "fileupload-primitive",
  title: "FileUpload",
  description: "Cross-platform file upload with drag and drop support",
  background: "surface-1",
  columns: 2,
  dynamicProps: {
    multiple: {
      type: "boolean",
      default: false,
      label: "Multiple Files"
    }
  },
  staticExamples: [
    { name: "Basic Upload", props: { accept: { "image/*": [".png", ".jpg", ".jpeg", ".gif"] } }, children: "Click or drag files here" },
    { name: "Multiple Files", props: { multiple: true }, children: "Upload multiple files" }
  ],
  quickTips: [
    "Supports drag and drop on web",
    "Use accept prop to filter file types",
    "maxSize prop limits file size",
    "onFilesSelected receives file array"
  ],
  codeExample: {
    title: "Image Upload",
    code: "import { FileUpload } from '@/components/primitives';\n\n<FileUpload\n  accept={{ 'image/*': ['.png', '.jpg'] }}\n  maxSize={5242880} // 5MB\n  onFilesSelected={(files) => {\n    logger.log('Files:', files);\n  }}\n>\n  <div className=\"border-2 border-dashed p-8\">\n    Drop images here or click to browse\n  </div>\n</FileUpload>"
  }
} as const;

export const FileUploadExamples: React.FC = () => {
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
