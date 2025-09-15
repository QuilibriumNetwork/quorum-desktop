import React, { useState } from 'react';
import { Modal, Button, Text, FlexColumn, FlexRow } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import primitivesConfig from '../primitivesConfig.json';

export const ModalExamples: React.FC = () => {
  const config = primitivesConfig.modal;
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
                <FlexColumn gap="md" className="p-4">
                  <Text variant="strong">{example.name}</Text>
                  <Text>{example.children}</Text>
                  <FlexRow gap="sm" justify="end">
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
                  </FlexRow>
                </FlexColumn>
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