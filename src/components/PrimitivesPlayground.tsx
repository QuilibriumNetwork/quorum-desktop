import React, { useState } from 'react';
import { ModalContainer } from './primitives/ModalContainer';
import { OverlayBackdrop } from './primitives/OverlayBackdrop';
import { FlexRow } from './primitives/FlexRow';
import { FlexBetween } from './primitives/FlexBetween';
import { FlexCenter } from './primitives/FlexCenter';
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
    <div className="p-8 space-y-8 h-full overflow-y-auto">
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
            {/* Close button - needs to trigger animation like ESC/backdrop */}
            <div
              className="quorum-modal-close select-none cursor-pointer"
              onClick={(e) => {
                // Stop propagation to prevent backdrop click
                e.stopPropagation();
                // Need to trigger ModalContainer's handleClose, not direct state change
                // For now, let's see if we can trigger ESC key event
                const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
                document.dispatchEvent(escEvent);
              }}
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
              <Button onClick={() => {
                // Trigger same animation as ESC key
                const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
                document.dispatchEvent(escEvent);
              }}>Close Modal</Button>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    // Trigger same animation as ESC key
                    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
                    document.dispatchEvent(escEvent);
                  }}
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
                  <Button onClick={() => {
                    // Trigger same animation as ESC key
                    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
                    document.dispatchEvent(escEvent);
                  }}>
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

      {/* Section: Flex Primitives */}
      <section className="border border-default rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold text-strong">Flex Primitives</h2>
        
        {/* FlexRow Examples */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-strong">FlexRow</h3>
          
          <div className="space-y-2">
            <p className="text-sm text-subtle">Basic row with gap:</p>
            <FlexRow gap="md" className="p-4 bg-surface-3 rounded-xl">
              <Button className="w-auto" onClick={() => {}}>Item 1</Button>
              <Button className="w-auto" onClick={() => {}}>Item 2</Button>
              <Button className="w-auto" onClick={() => {}}>Item 3</Button>
            </FlexRow>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-subtle">Row with different alignments:</p>
            <FlexRow justify="center" gap="lg" className="p-4 bg-surface-3 rounded-xl">
              <Button className="w-auto" onClick={() => {}}>Centered</Button>
              <Button className="w-auto" onClick={() => {}}>Items</Button>
            </FlexRow>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-subtle">Wrapping row:</p>
            <FlexRow gap="sm" wrap className="p-4 bg-surface-3 rounded-xl max-w-md">
              <Button className="w-auto" onClick={() => {}}>Button 1</Button>
              <Button className="w-auto" onClick={() => {}}>Button 2</Button>
              <Button className="w-auto" onClick={() => {}}>Button 3</Button>
              <Button className="w-auto" onClick={() => {}}>Button 4</Button>
              <Button className="w-auto" onClick={() => {}}>Button 5</Button>
            </FlexRow>
          </div>
        </div>

        {/* FlexBetween Examples */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-strong">FlexBetween</h3>
          
          <div className="space-y-2">
            <p className="text-sm text-subtle">Space between items:</p>
            <FlexBetween className="p-4 bg-surface-3 rounded-xl">
              <span className="text-main">Left Content</span>
              <Button className="w-auto" onClick={() => {}}>Right Action</Button>
            </FlexBetween>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-subtle">Multiple items on each side:</p>
            <FlexBetween className="p-4 bg-surface-3 rounded-xl">
              <FlexRow gap="sm">
                <span className="text-main">Title</span>
                <span className="text-subtle text-sm">(subtitle)</span>
              </FlexRow>
              <FlexRow gap="sm">
                <Button className="w-auto" onClick={() => {}}>Edit</Button>
                <Button className="w-auto" onClick={() => {}}>Delete</Button>
              </FlexRow>
            </FlexBetween>
          </div>
        </div>

        {/* FlexCenter Examples */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-strong">FlexCenter</h3>
          
          <div className="space-y-2">
            <p className="text-sm text-subtle">Center both axes:</p>
            <FlexCenter className="p-6 bg-surface-3 rounded-xl h-24">
              <Button className="w-auto" onClick={() => {}}>Centered Content</Button>
            </FlexCenter>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-subtle">Center horizontally only:</p>
            <FlexCenter direction="horizontal" className="p-4 bg-surface-3 rounded-xl">
              <Button className="w-auto" onClick={() => {}}>Horizontally Centered</Button>
            </FlexCenter>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-subtle">Center vertically only:</p>
            <FlexCenter direction="vertical" className="p-4 bg-surface-3 rounded-xl h-20">
              <Button className="w-auto" onClick={() => {}}>Vertically Centered</Button>
            </FlexCenter>
          </div>
        </div>
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