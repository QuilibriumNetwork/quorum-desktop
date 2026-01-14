import React, { useState } from 'react';
import { Modal, Button, Text, Flex } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';

export const ModalExamples: React.FC = () => {
  const config = {
    id: "modal-primitive",
    title: "Modal",
    description: "Cross-platform modal dialog component",
    background: "chat",
    columns: 3,
    hideLabels: true,
    dynamicProps: {
      size: {
        type: "select" as const,
        options: ["small", "medium", "large"],
        default: "medium",
        label: "Size"
      }
    },
    staticExamples: [
      { name: "Basic Modal", props: { hideClose: true }, children: "Modal content goes here" },
      { name: "With Close Button", props: { hideClose: false }, children: "Modal with close button" },
      { name: "No Backdrop Close", props: { closeOnBackdropClick: false }, children: "Click backdrop won't close this modal" }
    ],
    quickTips: [
      "Use size='medium' for most dialogs",
      "Always provide a way to close the modal",
      "Consider closeOnBackdrop=false for critical actions",
      "Test keyboard navigation (Escape key)"
    ],
    codeExample: {
      title: "All Modal Props",
      code: "import { Modal } from '@/components/primitives';\n\n<Modal\n  // Required props\n  visible={isOpen}\n  title=\"Modal Title\"\n  onClose={handleClose}\n  children={<div>Modal content</div>}\n  \n  // Sizing\n  size=\"medium\" // 'small' | 'medium' | 'large'\n  \n  // Close behavior\n  hideClose={false} // Hide the X button\n  closeOnBackdropClick={true} // Close when clicking outside\n  closeOnEscape={true} // Close with Escape key\n  \n  // Layout\n  noPadding={false} // Remove default padding\n  titleAlign=\"left\" // 'left' | 'center'\n  \n  // Styling\n  className=\"custom-modal-class\"\n  \n  // Native-specific props\n  // swipeToClose={true} // React Native only\n  // swipeUpToOpen={false} // React Native only\n  // keyboardAvoidingView={true} // React Native only\n>\n  <div>Your modal content here</div>\n</Modal>"
    }
  } as const;
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'medium',
  });

  const [openModals, setOpenModals] = useState<Record<string, boolean>>({});

  const openModal = (modalKey: string) => {
    setOpenModals(prev => ({ ...prev, [modalKey]: true }));
  };

  const closeModal = (modalKey: string) => {
    setOpenModals(prev => ({ ...prev, [modalKey]: false }));
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
        hideLabels={true}
        notes={{
          quickTips: config.quickTips,
          codeExample: config.codeExample,
        }}
      >
        {config.staticExamples.map((example, index) => {
          const modalKey = `modal-${index}`;
          const isOpen = openModals[modalKey] || false;

          return (
            <div key={index} className="flex flex-col gap-2 p-3">
              <Button
                type="secondary"
                onClick={() => openModal(modalKey)}
              >
                Open {example.name}
              </Button>

              <Modal
                {...example.props}
                {...dynamicProps}
                visible={isOpen}
                title={example.name}
                onClose={() => closeModal(modalKey)}
              >
                <Flex direction="column" gap="md" className="p-4">
                  <Text variant="strong">{example.name}</Text>
                  <Text>{example.children}</Text>
                  <Flex gap="sm" justify="end">
                    <Button
                      type="secondary"
                      onClick={() => closeModal(modalKey)}
                    >
                      Close
                    </Button>
                    <Button
                      type="primary"
                      onClick={() => closeModal(modalKey)}
                    >
                      Action
                    </Button>
                  </Flex>
                </Flex>
              </Modal>

              <span className="text-xs text-subtle text-center">
                {example.name}
              </span>
            </div>
          );
        })}
      </ExampleBox>
    </div>
  );
};