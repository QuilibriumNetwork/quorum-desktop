import React, { useState } from 'react';
import { ModalContainer } from './primitives/ModalContainer';
import { OverlayBackdrop } from './primitives/OverlayBackdrop';
import Button from './Button';
import ThemeRadioGroup from './ThemeRadioGroup';
import AccentColorSwitcher from './AccentColorSwitcher';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

/**
 * Playground for testing primitives during development
 * This component showcases all primitives and their usage patterns
 */
export const PrimitivesPlayground: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [showNoBackdropModal, setShowNoBackdropModal] = useState(false);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-strong mb-4">Primitives Playground</h1>
        <p className="text-main mb-4">
          Test and validate primitive components for the mobile architecture
        </p>
        
        {/* Theme and Color Controls */}
        <div className="flex flex-wrap items-center gap-6 p-4 bg-surface-1 rounded-lg mb-8">
          <ThemeRadioGroup horizontal />
          <AccentColorSwitcher />
        </div>
      </div>

      {/* Section: ModalContainer */}
      <section className="border border-default rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-strong">ModalContainer</h2>
        
        <div className="flex flex-wrap gap-3">
          <Button 
            className="w-auto"
            onClick={() => setShowModal(true)}
          >
            Show Modal with Backdrop
          </Button>
          
          <Button 
            className="w-auto"
            onClick={() => setShowNoBackdropModal(true)}
          >
            Show Modal without Backdrop
          </Button>
        </div>

        {/* Modal with backdrop */}
        <ModalContainer
          visible={showModal}
          onClose={() => setShowModal(false)}
          closeOnBackdropClick={true}
          closeOnEscape={true}
        >
          <div className="quorum-modal text-subtle relative pointer-events-auto">
            {/* Close button like existing modals */}
            <div
              className="quorum-modal-close select-none cursor-pointer"
              onClick={() => setShowModal(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </div>
            
            <div className="quorum-modal-title select-none cursor-default">
              Modal with Backdrop
            </div>
            
            <div className="quorum-modal-container">
              <p className="text-main mb-4">
                This modal uses the ModalContainer primitive with backdrop.
                Click outside, press Escape, or click the X to close.
              </p>
              <Button onClick={() => setShowModal(false)}>Close Modal</Button>
            </div>
          </div>
        </ModalContainer>

        {/* Modal without backdrop */}
        {showNoBackdropModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <ModalContainer
              visible={showNoBackdropModal}
              onClose={() => setShowNoBackdropModal(false)}
              showBackdrop={false}
              closeOnEscape={true}
              className="pointer-events-auto"
            >
              <div className="quorum-modal text-subtle relative pointer-events-auto shadow-xl">
                {/* Close button like existing modals */}
                <div
                  className="quorum-modal-close select-none cursor-pointer"
                  onClick={() => setShowNoBackdropModal(false)}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </div>
                
                <div className="quorum-modal-title select-none cursor-default">
                  Modal without Backdrop
                </div>
                
                <div className="quorum-modal-container">
                  <p className="text-main mb-4">
                    This modal has no backdrop. Press Escape or click the X to close.
                  </p>
                  <Button onClick={() => setShowNoBackdropModal(false)}>
                    Close Modal
                  </Button>
                </div>
              </div>
            </ModalContainer>
          </div>
        )}
      </section>

      {/* Section: OverlayBackdrop */}
      <section className="border border-default rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-strong">OverlayBackdrop</h2>
        
        <div className="flex flex-wrap gap-3">
          <Button 
            className="w-auto"
            onClick={() => setShowBackdrop(true)}
          >
            Show Backdrop Only
          </Button>
        </div>

        <OverlayBackdrop
          visible={showBackdrop}
          onBackdropClick={() => setShowBackdrop(false)}
          blur={true}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Content on Backdrop
            </h3>
            <p className="mb-4">
              This demonstrates the OverlayBackdrop primitive.
              Click the dark area to close.
            </p>
          </div>
        </OverlayBackdrop>
      </section>

      {/* Section: Flex Primitives (placeholder) */}
      <section className="border border-default rounded-lg p-6 space-y-4 opacity-50">
        <h2 className="text-xl font-semibold text-strong">
          Flex Primitives (Coming Soon)
        </h2>
        <p className="text-subtle">FlexRow, FlexBetween, FlexCenter primitives will appear here</p>
      </section>

      {/* Section: ResponsiveContainer (placeholder) */}
      <section className="border border-default rounded-lg p-6 space-y-4 opacity-50">
        <h2 className="text-xl font-semibold text-strong">
          ResponsiveContainer (Coming Soon)
        </h2>
        <p className="text-subtle">ResponsiveContainer primitive will appear here</p>
      </section>
    </div>
  );
};