import React, { useState } from 'react';
import { ModalContainer } from '../../components/primitives/ModalContainer';
import { OverlayBackdrop } from '../../components/primitives/OverlayBackdrop';
import { FlexRow } from '../../components/primitives/FlexRow';
import { FlexBetween } from '../../components/primitives/FlexBetween';
import { FlexCenter } from '../../components/primitives/FlexCenter';
import { ResponsiveContainer } from '../../components/primitives/ResponsiveContainer';
import { Input } from '../../components/primitives/Input';
import { TextArea } from '../../components/primitives/TextArea';
import { Switch } from '../../components/primitives/Switch';
import Button from '../../components/primitives/Button';
import Modal from '../../components/primitives/Modal';
import Select from '../../components/primitives/Select';
import { ColorSwatch } from '../../components/primitives/ColorSwatch';
import ThemeRadioGroup from '../../components/ThemeRadioGroup';
import AccentColorSwitcher from '../../components/AccentColorSwitcher';
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
  const [showModalPrimitive, setShowModalPrimitive] = useState(false);

  // ColorSwatch state
  const [activeColor, setActiveColor] = useState('blue');

  // Input testing state
  const [textValue, setTextValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [errorInput, setErrorInput] = useState('');
  const [showInputError, setShowInputError] = useState(false);

  // TextArea testing state
  const [textAreaValue, setTextAreaValue] = useState('');
  const [autoResizeValue, setAutoResizeValue] = useState('');
  const [errorTextArea, setErrorTextArea] = useState('');
  const [showTextAreaError, setShowTextAreaError] = useState(false);

  // Switch testing state
  const [basicSwitch, setBasicSwitch] = useState(false);
  const [switchSizes, setSwitchSizes] = useState({
    small: false,
    medium: true,
    large: false,
  });
  const [disabledSwitch, setDisabledSwitch] = useState(true);
  const [activeSection, setActiveSection] = useState('modalcontainer');

  // Select testing state
  const [selectValue, setSelectValue] = useState('');
  const [iconSelectValue, setIconSelectValue] = useState('react');
  const [errorSelectValue, setErrorSelectValue] = useState('');
  const [showSelectError, setShowSelectError] = useState(false);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navigationItems = [
    { id: 'modalcontainer', label: 'ModalContainer' },
    { id: 'overlaybackdrop', label: 'OverlayBackdrop' },
    { id: 'flex-primitives', label: 'Flex Primitives' },
    { id: 'responsivecontainer', label: 'ResponsiveContainer' },
    { id: 'button-primitive', label: 'Button Primitive' },
    { id: 'modal-primitive', label: 'Modal Primitive' },
    { id: 'input-primitive', label: 'Input Primitive' },
    { id: 'textarea-primitive', label: 'TextArea Primitive' },
    { id: 'switch-primitive', label: 'Switch Primitive' },
    { id: 'select-primitive', label: 'Select Primitive' },
    { id: 'colorswatch-primitive', label: 'ColorSwatch Primitive' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-surface-2 p-6 pr-8 rounded-tl-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-strong mb-2">
              Primitives Playground
            </h1>
            <p className="text-main text-sm">
              Test and validate primitive components. For mobile testing use the
              dedicated playground and the Expo native app.
            </p>
          </div>

          {/* Theme and Color Controls */}
          <div className="flex items-center gap-6 ml-auto">
            <ThemeRadioGroup horizontal />
            <AccentColorSwitcher />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden bg-surface-1">
        {/* Components Content */}
        <div className="flex-1 p-8 space-y-8 overflow-y-auto pr-80">
          {/* Section: ModalContainer */}
          <section
            id="modalcontainer"
            className="border border-default rounded-lg p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-strong">
              ModalContainer
            </h2>

            <div className="flex flex-wrap gap-3">
              <Button className="w-auto" onClick={() => setShowModal(true)}>
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
                    const escEvent = new KeyboardEvent('keydown', {
                      key: 'Escape',
                    });
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
                  <Button
                    onClick={() => {
                      // Trigger same animation as ESC key
                      const escEvent = new KeyboardEvent('keydown', {
                        key: 'Escape',
                      });
                      document.dispatchEvent(escEvent);
                    }}
                  >
                    Close Modal
                  </Button>
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
                        const escEvent = new KeyboardEvent('keydown', {
                          key: 'Escape',
                        });
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
                        This modal has no backdrop. Press Escape or click the X
                        to close.
                      </p>
                      <Button
                        onClick={() => {
                          // Trigger same animation as ESC key
                          const escEvent = new KeyboardEvent('keydown', {
                            key: 'Escape',
                          });
                          document.dispatchEvent(escEvent);
                        }}
                      >
                        Close Modal
                      </Button>
                    </div>
                  </div>
                </ModalContainer>
              </div>
            )}
          </section>

          {/* Section: OverlayBackdrop */}
          <section
            id="overlaybackdrop"
            className="border border-default rounded-lg p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-strong">
              OverlayBackdrop
            </h2>

            <div className="flex flex-wrap gap-3">
              <Button className="w-auto" onClick={() => setShowBackdrop(true)}>
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
                  This demonstrates the OverlayBackdrop primitive. Click the
                  dark area to close.
                </p>
              </div>
            </OverlayBackdrop>
          </section>

          {/* Section: Flex Primitives */}
          <section
            id="flex-primitives"
            className="border border-default rounded-lg p-6 space-y-6"
          >
            <h2 className="text-xl font-semibold text-strong">
              Flex Primitives
            </h2>

            {/* FlexRow Examples */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">FlexRow</h3>

              <div className="space-y-2">
                <p className="text-sm text-subtle">Basic row with gap:</p>
                <FlexRow gap="md" className="p-4 bg-surface-3 rounded-xl">
                  <Button className="w-auto" onClick={() => {}}>
                    Item 1
                  </Button>
                  <Button className="w-auto" onClick={() => {}}>
                    Item 2
                  </Button>
                  <Button className="w-auto" onClick={() => {}}>
                    Item 3
                  </Button>
                </FlexRow>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">
                  Row with different alignments:
                </p>
                <FlexRow
                  justify="center"
                  gap="lg"
                  className="p-4 bg-surface-3 rounded-xl"
                >
                  <Button className="w-auto" onClick={() => {}}>
                    Centered
                  </Button>
                  <Button className="w-auto" onClick={() => {}}>
                    Items
                  </Button>
                </FlexRow>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">Wrapping row:</p>
                <FlexRow
                  gap="sm"
                  wrap
                  className="p-4 bg-surface-3 rounded-xl max-w-md"
                >
                  <Button className="w-auto" onClick={() => {}}>
                    Button 1
                  </Button>
                  <Button className="w-auto" onClick={() => {}}>
                    Button 2
                  </Button>
                  <Button className="w-auto" onClick={() => {}}>
                    Button 3
                  </Button>
                  <Button className="w-auto" onClick={() => {}}>
                    Button 4
                  </Button>
                  <Button className="w-auto" onClick={() => {}}>
                    Button 5
                  </Button>
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
                  <Button className="w-auto" onClick={() => {}}>
                    Right Action
                  </Button>
                </FlexBetween>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">
                  Multiple items on each side:
                </p>
                <FlexBetween className="p-4 bg-surface-3 rounded-xl">
                  <FlexRow gap="sm">
                    <span className="text-main">Title</span>
                    <span className="text-subtle text-sm">(subtitle)</span>
                  </FlexRow>
                  <FlexRow gap="sm">
                    <Button className="w-auto" onClick={() => {}}>
                      Edit
                    </Button>
                    <Button className="w-auto" onClick={() => {}}>
                      Delete
                    </Button>
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
                  <Button className="w-auto" onClick={() => {}}>
                    Centered Content
                  </Button>
                </FlexCenter>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">Center horizontally only:</p>
                <FlexCenter
                  direction="horizontal"
                  className="p-4 bg-surface-3 rounded-xl"
                >
                  <Button className="w-auto" onClick={() => {}}>
                    Horizontally Centered
                  </Button>
                </FlexCenter>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">Center vertically only:</p>
                <FlexCenter
                  direction="vertical"
                  className="p-4 bg-surface-3 rounded-xl h-20"
                >
                  <Button className="w-auto" onClick={() => {}}>
                    Vertically Centered
                  </Button>
                </FlexCenter>
              </div>
            </div>
          </section>

          {/* Section: ResponsiveContainer */}
          <section
            id="responsivecontainer"
            className="border border-default rounded-lg p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-strong">
              ResponsiveContainer
            </h2>

            <div className="space-y-3">
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <p className="text-main mb-2">
                  <strong>
                    ℹ️ Layout Primitive (Working Behind the Scenes)
                  </strong>
                </p>
                <p className="text-subtle text-sm">
                  ResponsiveContainer is the invisible main content area that
                  wraps this entire playground. It works behind the scenes - you
                  won't see visual changes because you're already inside it!
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">
                  What ResponsiveContainer Fixed:
                </p>
                <div className="p-4 bg-surface-1 rounded-lg text-sm">
                  <ul className="space-y-1 text-subtle">
                    <li>
                      • <strong>Bug Fix:</strong> Desktop now uses 74px (was
                      incorrectly 72px)
                    </li>
                    <li>
                      • <strong>Consistency:</strong> Desktop & Tablet both use
                      74px nav offset
                    </li>
                    <li>
                      • <strong>Accuracy:</strong> Matches actual NavMenu.scss
                      widths exactly
                    </li>
                    <li>
                      • <strong>Cross-platform:</strong> React Native
                      implementation for mobile
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">
                  How it works (invisible to you):
                </p>
                <div className="p-4 bg-surface-1 rounded-lg text-sm">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="font-medium text-main">Phone</div>
                      <div className="text-subtle">≤ 480px</div>
                      <div className="text-subtle">
                        Container: calc(100vw - 50px)
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-main">Tablet</div>
                      <div className="text-subtle">481px - 1023px</div>
                      <div className="text-subtle">
                        Container: calc(100vw - 74px)
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-main">Desktop</div>
                      <div className="text-subtle">≥ 1024px</div>
                      <div className="text-subtle">
                        Container: calc(100vw - 74px)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">
                  This primitive is used in Layout.tsx and provides:
                </p>
                <div className="p-4 bg-surface-1 rounded-lg text-sm">
                  <ul className="space-y-1 text-subtle">
                    <li>• Fixed positioning for the main content area</li>
                    <li>• Automatic width calculation based on NavMenu size</li>
                    <li>
                      • Responsive breakpoints that adjust container bounds
                    </li>
                    <li>
                      • Cross-platform layout system for web and React Native
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Button Primitive */}
          <section
            id="button-primitive"
            className="border border-default rounded-lg p-6 space-y-6"
          >
            <h2 className="text-xl font-semibold text-strong">
              Button Primitive
            </h2>

            {/* Button Types */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">Button Types</h3>

              <div className="space-y-2">
                <p className="text-sm text-subtle">Primary variants:</p>
                <FlexRow gap="md" className="p-4 bg-surface-3 rounded-xl" wrap>
                  <Button type="primary" onClick={() => {}}>
                    Primary
                  </Button>
                  <Button type="secondary" onClick={() => {}}>
                    Secondary
                  </Button>
                  <Button type="light" onClick={() => {}}>
                    Light
                  </Button>
                  <Button type="light-outline" onClick={() => {}}>
                    Light Outline
                  </Button>
                </FlexRow>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">
                  Subtle and utility variants:
                </p>
                <FlexRow gap="md" className="p-4 bg-surface-3 rounded-xl" wrap>
                  <Button type="subtle" onClick={() => {}}>
                    Subtle
                  </Button>
                  <Button type="subtle-outline" onClick={() => {}}>
                    Subtle Outline
                  </Button>
                  <Button type="danger" onClick={() => {}}>
                    Danger
                  </Button>
                </FlexRow>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">
                  White variants (special use):
                </p>
                <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
                  <FlexRow gap="md" wrap>
                    <Button type="primary-white" onClick={() => {}}>
                      Primary White
                    </Button>
                    <Button type="secondary-white" onClick={() => {}}>
                      Secondary White
                    </Button>
                    <Button type="light-outline-white" onClick={() => {}}>
                      Light Outline White
                    </Button>
                  </FlexRow>
                </div>
              </div>
            </div>

            {/* Button Sizes and States */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                Sizes and States
              </h3>

              <div className="space-y-2">
                <p className="text-sm text-subtle">Size variants:</p>
                <FlexRow
                  gap="md"
                  align="center"
                  className="p-4 bg-surface-3 rounded-xl"
                >
                  <Button type="primary" size="normal" onClick={() => {}}>
                    Normal Size
                  </Button>
                  <Button type="primary" size="small" onClick={() => {}}>
                    Small Size
                  </Button>
                </FlexRow>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">Disabled states:</p>
                <FlexRow gap="md" className="p-4 bg-surface-3 rounded-xl">
                  <Button type="primary" disabled onClick={() => {}}>
                    Disabled Primary
                  </Button>
                  <Button type="secondary" disabled onClick={() => {}}>
                    Disabled Secondary
                  </Button>
                </FlexRow>
              </div>
            </div>

            {/* Button with Tooltips */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                Interactive Features
              </h3>

              <div className="space-y-2">
                <p className="text-sm text-subtle">Buttons with tooltips:</p>
                <FlexRow gap="md" className="p-4 bg-surface-3 rounded-xl">
                  <Button
                    type="primary"
                    tooltip="This is a helpful tooltip"
                    onClick={() => {}}
                  >
                    Hover for Tooltip
                  </Button>
                  <Button
                    type="secondary"
                    tooltip="Highlighted tooltip!"
                    highlightedTooltip
                    onClick={() => {}}
                  >
                    Highlighted Tooltip
                  </Button>
                </FlexRow>
              </div>
            </div>
          </section>

          {/* Section: Modal Primitive */}
          <section
            id="modal-primitive"
            className="border border-default rounded-lg p-6 space-y-6"
          >
            <h2 className="text-xl font-semibold text-strong">
              Modal Primitive
            </h2>

            {/* Modal Types */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                Modal Variants
              </h3>

              <div className="space-y-2">
                <p className="text-sm text-subtle">
                  Using ModalContainer primitive:
                </p>
                <FlexRow gap="md" className="p-4 bg-surface-3 rounded-xl" wrap>
                  <Button onClick={() => setShowModalPrimitive(true)}>
                    Show Modal Primitive
                  </Button>
                </FlexRow>
              </div>
            </div>

            {/* Modal Primitive Demo */}
            <Modal
              title="Modal Primitive Demo"
              visible={showModalPrimitive}
              onClose={() => setShowModalPrimitive(false)}
              size="medium"
            >
              <div className="space-y-4">
                <p className="text-main">
                  This modal is built using the Modal primitive, which
                  internally uses the ModalContainer primitive for backdrop and
                  animations.
                </p>

                <div className="space-y-2">
                  <h4 className="font-semibold text-strong">Key Features:</h4>
                  <ul className="text-sm text-subtle space-y-1 list-disc list-inside">
                    <li>
                      Uses ModalContainer for consistent backdrop behavior
                    </li>
                    <li>Smooth open/close animations</li>
                    <li>ESC key and backdrop click to close</li>
                    <li>Size variants (small, medium, large, full)</li>
                    <li>Desktop modal → Mobile drawer transformation</li>
                  </ul>
                </div>

                <FlexRow gap="md" justify="end">
                  <Button
                    type="secondary"
                    onClick={() => {
                      // Trigger ESC key event to use ModalContainer's animation
                      const escEvent = new KeyboardEvent('keydown', {
                        key: 'Escape',
                      });
                      document.dispatchEvent(escEvent);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => {
                      // Trigger ESC key event to use ModalContainer's animation
                      const escEvent = new KeyboardEvent('keydown', {
                        key: 'Escape',
                      });
                      document.dispatchEvent(escEvent);
                    }}
                  >
                    Confirm
                  </Button>
                </FlexRow>
              </div>
            </Modal>
          </section>

          {/* Section: Input Primitive */}
          <section
            id="input-primitive"
            className="border border-default rounded-lg p-6 space-y-4 bg-surface-5"
          >
            <h2 className="text-xl font-semibold text-strong">
              Input Primitive
            </h2>
            <p className="text-subtle">
              Cross-platform input field primitive with error handling
            </p>

            {/* Input Types */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">Input Types</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Text Input:
                  </label>
                  <Input
                    value={textValue}
                    onChange={setTextValue}
                    placeholder="Enter some text..."
                    type="text"
                  />
                  <p className="text-xs text-subtle">Value: "{textValue}"</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Email Input:
                  </label>
                  <Input
                    value={emailValue}
                    onChange={setEmailValue}
                    placeholder="Enter your email..."
                    type="email"
                  />
                  <p className="text-xs text-subtle">Value: "{emailValue}"</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Password Input:
                  </label>
                  <Input
                    value={passwordValue}
                    onChange={setPasswordValue}
                    placeholder="Enter password..."
                    type="password"
                  />
                  <p className="text-xs text-subtle">
                    Value: "
                    {passwordValue ? '•'.repeat(passwordValue.length) : ''}"
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Disabled Input:
                  </label>
                  <Input
                    value="Cannot edit this"
                    placeholder="Disabled input..."
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Error States */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">Error States</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Input with Error:
                  </label>
                  <Input
                    value={errorInput}
                    onChange={(value) => {
                      setErrorInput(value);
                      setShowInputError(value.length > 0 && value.length < 3);
                    }}
                    placeholder="Type less than 3 characters to see error..."
                    error={showInputError}
                    errorMessage={
                      showInputError
                        ? 'Input must be at least 3 characters long'
                        : undefined
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Always Error:
                  </label>
                  <Input
                    value=""
                    placeholder="This input is always in error state"
                    error={true}
                    errorMessage="This is a persistent error message"
                  />
                </div>
              </div>
            </div>

            {/* Focus and Styling */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                Focus & Styling
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Auto Focus Input:
                  </label>
                  <Input placeholder="This input auto-focuses" autoFocus />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Custom Style:
                  </label>
                  <Input
                    placeholder="Custom styled input"
                    style={{
                      borderRadius: '20px',
                      backgroundColor: 'var(--accent-50)',
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    No Focus Style:
                  </label>
                  <Input
                    placeholder="This input has no focus border/shadow"
                    noFocusStyle
                  />
                </div>
              </div>
            </div>

            {/* Onboarding Variant */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                Onboarding Variant
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Onboarding Style:
                  </label>
                  <Input
                    variant="onboarding"
                    placeholder="Bongocat"
                    className="!bg-white"
                  />
                  <p className="text-xs text-subtle">
                    Full pill shape with accent colors (for Login/Onboarding
                    pages)
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Onboarding with Legacy onChange:
                  </label>
                  <Input
                    variant="onboarding"
                    placeholder="Test legacy onChange"
                    onChange={(e) =>
                      console.log('Legacy onChange:', e.target.value)
                    }
                    className="!bg-white"
                  />
                  <p className="text-xs text-subtle">
                    Tests backward compatibility with (e) =&gt; e.target.value
                    pattern
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Testing Notes */}
            <div className="p-4 bg-surface-1 rounded-lg">
              <h4 className="font-semibold text-strong mb-2">
                📱 Mobile Testing Notes
              </h4>
              <ul className="text-sm text-subtle space-y-1 list-disc list-inside">
                <li>
                  Input types (email, password) should trigger appropriate
                  mobile keyboards
                </li>
                <li>Touch targets are 42px high for accessibility</li>
                <li>Focus states use platform-appropriate styling</li>
                <li>Error messages display below input on both platforms</li>
                <li>
                  This Input primitive is NOT for chat/message inputs (see
                  MessageInput business component)
                </li>
              </ul>
            </div>
          </section>

          {/* Section: TextArea Primitive */}
          <section
            id="textarea-primitive"
            className="border border-default rounded-lg p-6 space-y-4 bg-surface-5"
          >
            <h2 className="text-xl font-semibold text-strong">
              TextArea Primitive
            </h2>
            <p className="text-subtle">
              Cross-platform multiline text input primitive with auto-resize
              support
            </p>

            {/* Basic TextArea Types */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                Basic TextArea
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Standard TextArea:
                  </label>
                  <TextArea
                    value={textAreaValue}
                    onChange={setTextAreaValue}
                    placeholder="Enter your message here..."
                    rows={3}
                  />
                  <p className="text-xs text-subtle">
                    Lines: {textAreaValue.split('\n').length} | Chars:{' '}
                    {textAreaValue.length}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Auto-Resize TextArea:
                  </label>
                  <TextArea
                    value={autoResizeValue}
                    onChange={setAutoResizeValue}
                    placeholder="Type multiple lines to see auto-resize..."
                    autoResize
                    minRows={2}
                    maxRows={6}
                  />
                  <p className="text-xs text-subtle">
                    Auto-resizes between 2-6 rows
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Large TextArea:
                  </label>
                  <TextArea
                    placeholder="Large text area for longer content..."
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Disabled TextArea:
                  </label>
                  <TextArea
                    value="This content cannot be edited"
                    placeholder="Disabled text area..."
                    disabled
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Error States */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">Error States</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    TextArea with Error (type less than 10 chars):
                  </label>
                  <TextArea
                    value={errorTextArea}
                    onChange={(value) => {
                      setErrorTextArea(value);
                      setShowTextAreaError(
                        value.length > 0 && value.length < 10
                      );
                    }}
                    placeholder="Type less than 10 characters to see error..."
                    error={showTextAreaError}
                    errorMessage={
                      showTextAreaError
                        ? 'Text must be at least 10 characters long'
                        : undefined
                    }
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Always Error:
                  </label>
                  <TextArea
                    value=""
                    placeholder="This textarea is always in error state"
                    error={true}
                    errorMessage="This is a persistent error message for textarea"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Onboarding Variant */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                Onboarding Variant
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Onboarding Style:
                  </label>
                  <TextArea
                    variant="onboarding"
                    placeholder="Tell us about yourself..."
                    className="!bg-white"
                    rows={4}
                  />
                  <p className="text-xs text-subtle">
                    Rounded corners with accent colors (for Login/Onboarding
                    pages)
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Onboarding Auto-Resize:
                  </label>
                  <TextArea
                    variant="onboarding"
                    placeholder="Type multiple lines..."
                    autoResize
                    minRows={3}
                    maxRows={7}
                    className="!bg-white"
                  />
                  <p className="text-xs text-subtle">
                    Onboarding style with auto-resize
                  </p>
                </div>
              </div>
            </div>

            {/* Focus and Styling */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                Focus & Styling
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Auto Focus TextArea:
                  </label>
                  <TextArea
                    placeholder="This textarea auto-focuses"
                    autoFocus
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    No Focus Style:
                  </label>
                  <TextArea
                    placeholder="This textarea has no focus styling"
                    noFocusStyle
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Resizable TextArea:
                  </label>
                  <TextArea
                    placeholder="You can manually resize this textarea"
                    resize={true}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Non-Resizable (default):
                  </label>
                  <TextArea
                    placeholder="This textarea cannot be manually resized"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Mobile Testing Notes */}
            <div className="p-4 bg-surface-1 rounded-lg">
              <h4 className="font-semibold text-strong mb-2">
                📱 Mobile Testing Notes
              </h4>
              <ul className="text-sm text-subtle space-y-1 list-disc list-inside">
                <li>Auto-resize functionality works on both web and mobile</li>
                <li>Touch targets are optimized for mobile accessibility</li>
                <li>Focus states use platform-appropriate styling</li>
                <li>Error messages display below textarea on both platforms</li>
                <li>
                  This TextArea primitive is NOT the auto-growing MessageInput
                  (see business component later)
                </li>
                <li>
                  Multiline text input works correctly on mobile keyboards
                </li>
              </ul>
            </div>
          </section>

          {/* Section: Switch Primitive */}
          <section
            id="switch-primitive"
            className="border border-default rounded-lg p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-strong">
              Switch Primitive
            </h2>
            <p className="text-subtle">
              Cross-platform toggle switch with multiple sizes and variants
            </p>

            {/* Basic Switch */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">Basic Switch</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong flex items-center gap-3">
                    <Switch value={basicSwitch} onChange={setBasicSwitch} />
                    Basic Switch {basicSwitch ? '(ON)' : '(OFF)'}
                  </label>
                  <p className="text-xs text-subtle">Click to toggle</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong flex items-center gap-3">
                    <Switch
                      value={disabledSwitch}
                      onChange={setDisabledSwitch}
                      disabled
                    />
                    Disabled Switch (ON)
                  </label>
                  <p className="text-xs text-subtle">Cannot be toggled</p>
                </div>
              </div>
            </div>

            {/* Switch Sizes */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">Switch Sizes</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong flex items-center gap-3">
                    <Switch
                      value={switchSizes.small}
                      onChange={(value) =>
                        setSwitchSizes((prev) => ({ ...prev, small: value }))
                      }
                      size="small"
                    />
                    Small
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong flex items-center gap-3">
                    <Switch
                      value={switchSizes.medium}
                      onChange={(value) =>
                        setSwitchSizes((prev) => ({ ...prev, medium: value }))
                      }
                      size="medium"
                    />
                    Medium (default)
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong flex items-center gap-3">
                    <Switch
                      value={switchSizes.large}
                      onChange={(value) =>
                        setSwitchSizes((prev) => ({ ...prev, large: value }))
                      }
                      size="large"
                    />
                    Large
                  </label>
                </div>
              </div>
            </div>

            {/* Mobile Testing Notes */}
            <div className="p-4 bg-surface-1 rounded-lg">
              <h4 className="font-semibold text-strong mb-2">
                📱 Mobile Testing Notes
              </h4>
              <ul className="text-sm text-subtle space-y-1 list-disc list-inside">
                <li>
                  Web: Custom styled switch with smooth animations and accent
                  color
                </li>
                <li>
                  Mobile: Native platform Switch component (iOS/Android styles)
                </li>
                <li>Three sizes available: small, medium (default), large</li>
                <li>Touch targets are optimized for mobile accessibility</li>
                <li>Platform-specific colors and haptic feedback (iOS)</li>
                <li>Focus states work with keyboard navigation on web</li>
              </ul>
            </div>
          </section>

          {/* Section: Select Primitive */}
          <section
            id="select-primitive"
            className="border border-default rounded-lg p-6 space-y-4 bg-surface-5"
          >
            <h2 className="text-xl font-semibold text-strong">
              Select Primitive
            </h2>
            <p className="text-subtle">
              Cross-platform dropdown/picker component with rich options and
              customization
            </p>

            {/* All Select Examples in 4-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Row 1: Basic Select (2 cells) */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3">
                  Basic Select
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  Simple Select
                </label>
                <Select
                  value={selectValue}
                  onChange={setSelectValue}
                  placeholder="Choose an option"
                  options={[
                    { value: 'apple', label: 'Apple' },
                    { value: 'banana', label: 'Banana' },
                    { value: 'cherry', label: 'Cherry' },
                    { value: 'date', label: 'Date' },
                    { value: 'elderberry', label: 'Elderberry' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3 opacity-0">
                  Hidden
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  With Icons (Temp Emoji)
                </label>
                <Select
                  value={iconSelectValue}
                  onChange={setIconSelectValue}
                  placeholder="Choose a framework"
                  options={[
                    { value: 'react', label: 'React', icon: '⚛️' },
                    { value: 'vue', label: 'Vue.js', icon: '💚' },
                    { value: 'angular', label: 'Angular', icon: '🅰️' },
                    { value: 'svelte', label: 'Svelte', icon: '🧡' },
                    { value: 'nextjs', label: 'Next.js', icon: '▲' },
                  ]}
                />
              </div>

              {/* Empty cells for row 1 */}
              <div></div>
              <div></div>

              {/* Row 2: Select Sizes (3 cells) */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3">
                  Select Sizes
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  Small
                </label>
                <Select
                  size="small"
                  value=""
                  onChange={() => {}}
                  placeholder="Small select"
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3 opacity-0">
                  Hidden
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  Medium (Default)
                </label>
                <Select
                  size="medium"
                  value=""
                  onChange={() => {}}
                  placeholder="Medium select"
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3 opacity-0">
                  Hidden
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  Large
                </label>
                <Select
                  size="large"
                  value=""
                  onChange={() => {}}
                  placeholder="Large select"
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                  ]}
                />
              </div>

              {/* Empty cell for row 2 */}
              <div></div>

              {/* Row 3: Select Variants (2 cells) */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3">
                  Select Variants
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  Default (Bordered)
                </label>
                <Select
                  variant="default"
                  value=""
                  onChange={() => {}}
                  placeholder="Default style"
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3 opacity-0">
                  Hidden
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  Filled
                </label>
                <Select
                  variant="filled"
                  value=""
                  onChange={() => {}}
                  placeholder="Filled style"
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                  ]}
                />
              </div>

              {/* Empty cells for row 3 */}
              <div></div>

              {/* Empty cell for row 3 */}
              <div></div>

              {/* Row 4: Error States (2 cells) */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3">
                  Error States
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  With Error
                </label>
                <Select
                  value={errorSelectValue}
                  onChange={setErrorSelectValue}
                  placeholder="Select with error"
                  error={showSelectError}
                  errorMessage="This field is required"
                  options={[
                    { value: 'valid', label: 'Valid Option' },
                    { value: 'invalid', label: 'Invalid Option' },
                  ]}
                />
                <Button
                  size="small"
                  type="secondary"
                  className="w-[150px]"
                  onClick={() => setShowSelectError(!showSelectError)}
                >
                  Toggle Error
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3 opacity-0">
                  Hidden
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  Disabled
                </label>
                <Select
                  value="disabled"
                  onChange={() => {}}
                  disabled
                  options={[
                    { value: 'disabled', label: 'Cannot change this' },
                    { value: 'option2', label: 'Option 2' },
                  ]}
                />
              </div>

              {/* Empty cells for row 4 */}
              <div></div>
              <div></div>

              {/* Row 5: Advanced Features (2 cells) */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3">
                  Advanced Features
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  Full Width
                </label>
                <Select
                  fullWidth
                  value=""
                  onChange={() => {}}
                  placeholder="Full width select"
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3 opacity-0">
                  Hidden
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  With Disabled Options
                </label>
                <Select
                  value=""
                  onChange={() => {}}
                  placeholder="Select with disabled options"
                  options={[
                    { value: 'available', label: 'Available Option' },
                    {
                      value: 'disabled1',
                      label: 'Disabled Option 1',
                      disabled: true,
                    },
                    { value: 'available2', label: 'Another Available' },
                    {
                      value: 'disabled2',
                      label: 'Disabled Option 2',
                      disabled: true,
                    },
                  ]}
                />
              </div>

              {/* Row 6: Custom Width Examples (2 cells) */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3">
                  Custom Width
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  Custom 200px
                </label>
                <Select
                  width="200px"
                  value=""
                  onChange={() => {}}
                  placeholder="Exactly 200px wide"
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                  ]}
                />
                <p className="text-xs text-subtle">Uses width="200px" prop</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium text-strong mb-3 opacity-0">
                  Hidden
                </h3>
                <label className="text-sm font-medium text-strong mb-2 block">
                  Custom 100px (Narrow)
                </label>
                <Select
                  width="100px"
                  value=""
                  onChange={() => {}}
                  placeholder="Very narrow"
                  options={[
                    { value: 'short', label: 'Short' },
                    { value: 'longer-text', label: 'Longer Text Example' },
                  ]}
                />
                <p className="text-xs text-subtle">
                  Demonstrates text ellipsis
                </p>
              </div>

              {/* Empty cells for row 6 */}
              <div></div>
              <div></div>
            </div>

            {/* Implementation Notes */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                Implementation Notes
              </h3>
              <ul className="list-disc list-inside text-sm text-subtle space-y-1">
                <li>
                  Web: Custom dropdown with keyboard navigation and
                  accessibility
                </li>
                <li>
                  Mobile: Modal-based picker optimized for touch interaction
                </li>
                <li>
                  Width management: min-width 150px, max-width 280px, custom
                  width prop
                </li>
                <li>
                  Text overflow: Ellipsis truncation for long text, no layout
                  shifts
                </li>
                <li>
                  Icons are temporary emoji placeholders (FontAwesome
                  integration pending)
                </li>
                <li>
                  Form integration with hidden native select for web
                  compatibility
                </li>
                <li>Click-outside detection and escape key support</li>
                <li>Consistent theme integration across platforms</li>
                <li>Support for disabled options and error states</li>
              </ul>
            </div>
          </section>

          {/* Section: ColorSwatch Primitive */}
          <section
            id="colorswatch-primitive"
            className="border border-default rounded-lg p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-strong">
              ColorSwatch Primitive
            </h2>
            <p className="text-subtle">
              Color picker component for selecting accent colors with visual
              feedback
            </p>

            {/* Basic ColorSwatch Examples */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-strong">Basic Usage</h3>

              <div className="space-y-2">
                <p className="text-sm text-subtle">Click to select colors:</p>
                <div className="flex gap-3 p-4 bg-surface-1 rounded-lg">
                  {[
                    'blue',
                    'purple',
                    'fuchsia',
                    'orange',
                    'green',
                    'yellow',
                  ].map((color) => (
                    <ColorSwatch
                      key={color}
                      color={color}
                      isActive={activeColor === color}
                      onPress={() => setActiveColor(color)}
                    />
                  ))}
                </div>
              </div>

              {/* Size Variants */}
              <div className="space-y-2">
                <h4 className="text-md font-medium text-strong">
                  Size Variants
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-subtle w-20">Small:</span>
                    <div className="flex gap-2">
                      {['blue', 'purple', 'green'].map((color) => (
                        <ColorSwatch
                          key={color}
                          color={color}
                          size="small"
                          isActive={false}
                          onPress={() => {}}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-subtle w-20">Medium:</span>
                    <div className="flex gap-2">
                      {['blue', 'purple', 'green'].map((color) => (
                        <ColorSwatch
                          key={color}
                          color={color}
                          size="medium"
                          isActive={false}
                          onPress={() => {}}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-subtle w-20">Large:</span>
                    <div className="flex gap-2">
                      {['blue', 'purple', 'green'].map((color) => (
                        <ColorSwatch
                          key={color}
                          color={color}
                          size="large"
                          isActive={false}
                          onPress={() => {}}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* States */}
              <div className="space-y-2">
                <h4 className="text-md font-medium text-strong">States</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-subtle w-20">Active:</span>
                    <ColorSwatch
                      color="blue"
                      isActive={true}
                      onPress={() => {}}
                    />
                    <span className="text-sm text-muted">Shows checkmark</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-subtle w-20">Disabled:</span>
                    <ColorSwatch
                      color="purple"
                      disabled={true}
                      onPress={() => {}}
                    />
                    <span className="text-sm text-muted">
                      50% opacity, no interaction
                    </span>
                  </div>
                </div>
              </div>

              {/* Without Checkmark */}
              <div className="space-y-2">
                <h4 className="text-md font-medium text-strong">
                  Custom Options
                </h4>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-subtle w-32">
                    No checkmark:
                  </span>
                  <ColorSwatch
                    color="orange"
                    isActive={true}
                    showCheckmark={false}
                    onPress={() => {}}
                  />
                  <span className="text-sm text-muted">
                    Active without checkmark icon
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile Testing Notes */}
            <div className="p-4 bg-surface-1 rounded-lg">
              <h4 className="font-semibold text-strong mb-2">
                📱 Mobile Testing Notes
              </h4>
              <ul className="text-sm text-subtle space-y-1 list-disc list-inside">
                <li>Web: Uses FontAwesome check icon in selected state</li>
                <li>
                  Mobile: Uses ✓ character temporarily (FontAwesome pending)
                </li>
                <li>Touch targets optimized for mobile interaction</li>
                <li>Active state includes border and shadow for visibility</li>
                <li>Keyboard accessible with Enter/Space key support on web</li>
                <li>ARIA attributes for screen reader accessibility</li>
                <li>Hover effects on web, press feedback on mobile</li>
              </ul>
            </div>
          </section>
        </div>
      </div>

      {/* Right Sidebar Navigation */}
      <div className="fixed right-0 top-[120px] h-[calc(100vh-120px)] w-80 p-6 overflow-y-auto z-10">
        <div className="mt-2">
          <div className="border border-default rounded-lg p-6">
            <h3 className="text-lg font-semibold text-strong mb-4">
              Quick Navigation
            </h3>
            <nav className="space-y-2">
              {navigationItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-3 hover:text-strong rounded-lg transition-colors duration-150 cursor-pointer ${
                    activeSection === item.id
                      ? 'border border-accent-500 text-strong bg-surface-2'
                      : 'text-main'
                  }`}
                >
                  {item.label}
                </div>
              ))}
            </nav>

            {/* Quick Actions */}
            <div className="mt-8 pt-6 border-t border-default">
              <div className="space-y-2">
                <div
                  onClick={() => scrollToSection('modalcontainer')}
                  className="w-full text-left px-3 py-2 text-sm text-subtle hover:bg-surface-3 hover:text-main rounded-lg transition-colors duration-150 cursor-pointer"
                >
                  ↑ Back to Top
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
