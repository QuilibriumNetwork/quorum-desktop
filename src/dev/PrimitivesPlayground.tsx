import React, { useState } from 'react';
import {
  ModalContainer,
  OverlayBackdrop,
  Container,
  FlexRow,
  FlexColumn,
  FlexBetween,
  FlexCenter,
  Input,
  TextArea,
  Switch,
  Button,
  Modal,
  Select,
  ColorSwatch,
  RadioGroup,
  Tooltip,
  Icon,
  Text,
  FileUpload,
} from '@/components/primitives';
import ThemeRadioGroup from '@/components/ThemeRadioGroup';
import AccentColorSwitcher from '@/components/AccentColorSwitcher';

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

  // RadioGroup state
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [selectedSize, setSelectedSize] = useState('medium');
  const [selectedOption, setSelectedOption] = useState('option1');

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

  // FileUpload testing state
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Switch testing state
  const [basicSwitch, setBasicSwitch] = useState(false);
  const [switchSizes, setSwitchSizes] = useState({
    small: false,
    medium: true,
    large: false,
  });
  const [disabledSwitch, setDisabledSwitch] = useState(true);
  const [activeSection, setActiveSection] = useState('modalcontainer');



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
    { id: 'container-primitive', label: 'Container' },
    { id: 'flex-primitives', label: 'Flex Primitives' },
    { id: 'responsivecontainer', label: 'ResponsiveContainer' },
    { id: 'text-primitive', label: 'Text' },
    { id: 'button-primitive', label: 'Button' },
    { id: 'modal-primitive', label: 'Modal' },
    { id: 'input-primitive', label: 'Input' },
    { id: 'textarea-primitive', label: 'TextArea' },
    { id: 'switch-primitive', label: 'Switch' },
    { id: 'select-primitive', label: 'Select' },
    { id: 'colorswatch-primitive', label: 'ColorSwatch' },
    { id: 'radiogroup-primitive', label: 'RadioGroup' },
    { id: 'tooltip-primitive', label: 'Tooltip' },
    { id: 'icon-primitive', label: 'Icon' },
    { id: 'fileupload-primitive', label: 'FileUpload' },
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
                  <Icon name="close" />
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
                      <Icon name="close" />
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

          {/* Section: Container Primitive */}
          <section
            id="container-primitive"
            className="border border-default rounded-lg p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-strong">Container</h2>
            <p className="text-subtle">
              Flexible container primitive with width, padding, margin, and
              background options
            </p>

            <div className="space-y-6">
              {/* Basic Container Examples */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Basic Containers
                </h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-subtle mb-2">
                      Container with padding:
                    </p>
                    <Container padding="md" backgroundColor="var(--surface-4)">
                      <Text>Container with medium padding</Text>
                    </Container>
                  </div>

                  <div>
                    <p className="text-sm text-subtle mb-2">
                      Container with margin and full width:
                    </p>
                    <Container
                      width="full"
                      margin="sm"
                      padding="lg"
                      backgroundColor="var(--surface-4)"
                    >
                      <Text>
                        Full width container with margin and large padding
                      </Text>
                    </Container>
                  </div>

                  <div>
                    <p className="text-sm text-subtle mb-2">
                      Container with max width:
                    </p>
                    <Container
                      width="full"
                      maxWidth="md"
                      padding="md"
                      backgroundColor="var(--surface-4)"
                      className="mx-auto"
                    >
                      <Text>Container with max-width md (768px)</Text>
                    </Container>
                  </div>
                </div>
              </div>

              {/* Interactive Containers */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Interactive Containers
                </h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-subtle mb-2">
                      Clickable Container:
                    </p>
                    <Container
                      padding="md"
                      backgroundColor="var(--surface-4)"
                      onClick={() => alert('Container clicked!')}
                      className="cursor-pointer hover:bg-surface-4 transition-colors"
                    >
                      <Text>Click this container!</Text>
                    </Container>
                  </div>

                  <div>
                    <p className="text-sm text-subtle mb-2">
                      Container with hover effects:
                    </p>
                    <Container
                      padding="lg"
                      backgroundColor="var(--surface-4)"
                      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) =>
                        (e.currentTarget.style.backgroundColor =
                          'var(--accent-700)')
                      }
                      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) =>
                        (e.currentTarget.style.backgroundColor =
                          'var(--accent-900)')
                      }
                      className="transition-all duration-200"
                    >
                      <Text>Hover over this container to see color change</Text>
                    </Container>
                  </div>
                </div>
              </div>

              {/* Nested Containers */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Nested Containers
                </h3>

                <Container
                  padding="xl"
                  backgroundColor="var(--surface-4)"
                  className="space-y-4"
                >
                  <Text weight="semibold">Parent Container (XL padding)</Text>

                  <Container
                    padding="md"
                    margin="sm"
                    backgroundColor="var(--surface-5)"
                  >
                    <Text>Child Container 1 (MD padding, SM margin)</Text>
                  </Container>

                  <Container
                    padding="sm"
                    margin="md"
                    backgroundColor="var(--surface-6)"
                  >
                    <Text>Child Container 2 (SM padding, MD margin)</Text>
                  </Container>

                  <FlexRow gap="md">
                    <Container
                      padding="sm"
                      backgroundColor="var(--surface-7)"
                      className="flex-1"
                    >
                      <Text size="sm">Flex item 1</Text>
                    </Container>
                    <Container
                      padding="sm"
                      backgroundColor="var(--surface-7)"
                      className="flex-1"
                    >
                      <Text size="sm">Flex item 2</Text>
                    </Container>
                  </FlexRow>
                </Container>
              </div>
            </div>

            {/* Mobile Testing Notes */}
            <div className="p-4 bg-surface-1 rounded-lg">
              <h4 className="font-semibold text-strong mb-2">
              Mobile Testing Notes
              </h4>
              <ul className="text-sm text-subtle space-y-1 list-disc list-inside">
                <li>Web: Uses div with CSS classes for styling</li>
                <li>Mobile: Uses View with StyleSheet for React Native</li>
                <li>TouchableOpacity wrapper when onPress is provided</li>
                <li>Padding/margin values map to consistent spacing scale</li>
                <li>Width and maxWidth props work across both platforms</li>
                <li>Essential building block for layouts</li>
              </ul>
            </div>
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

            {/* FlexColumn Examples */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">FlexColumn</h3>

              <div className="space-y-2">
                <p className="text-sm text-subtle">Basic column with gap:</p>
                <FlexColumn gap="md" className="p-4 bg-surface-3 rounded-xl">
                  <Button className="w-full" onClick={() => {}}>
                    Item 1
                  </Button>
                  <Button className="w-full" onClick={() => {}}>
                    Item 2
                  </Button>
                  <Button className="w-full" onClick={() => {}}>
                    Item 3
                  </Button>
                </FlexColumn>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">
                  Column with different alignments:
                </p>
                <FlexColumn
                  align="center"
                  gap="lg"
                  className="p-4 bg-surface-3 rounded-xl"
                >
                  <Text>Centered items</Text>
                  <Button className="w-auto" onClick={() => {}}>
                    Centered Button
                  </Button>
                  <Text size="sm" variant="subtle">
                    All items centered
                  </Text>
                </FlexColumn>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">
                  Column with justify-between:
                </p>
                <FlexColumn
                  justify="between"
                  className="p-4 bg-surface-3 rounded-xl h-48"
                >
                  <Text>Top item</Text>
                  <Text>Middle gets pushed apart</Text>
                  <Button className="w-auto" onClick={() => {}}>
                    Bottom item
                  </Button>
                </FlexColumn>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-subtle">
                  Wrapping column (rare use case):
                </p>
                <FlexColumn
                  gap="sm"
                  wrap
                  className="p-4 bg-surface-3 rounded-xl h-32"
                >
                  <span className="px-3 py-1 bg-accent-100 rounded">Tag 1</span>
                  <span className="px-3 py-1 bg-accent-100 rounded">Tag 2</span>
                  <span className="px-3 py-1 bg-accent-100 rounded">Tag 3</span>
                  <span className="px-3 py-1 bg-accent-100 rounded">Tag 4</span>
                  <span className="px-3 py-1 bg-accent-100 rounded">Tag 5</span>
                  <span className="px-3 py-1 bg-accent-100 rounded">Tag 6</span>
                </FlexColumn>
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

          {/* Section: Text Primitive */}
          <section
            id="text-primitive"
            className="border border-default rounded-lg p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-strong">Text</h2>
            <p className="text-subtle">
              Essential text component for React Native compatibility with
              variants, sizes, and weights
            </p>

            <div className="space-y-6">
              {/* Text Variants */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Text Variants
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-surface-3 rounded-xl">
                    <Text variant="default">
                      Default variant - Regular text for content
                    </Text>
                  </div>

                  <div className="p-4 bg-surface-3 rounded-xl">
                    <Text variant="strong">
                      Strong variant - Important emphasis
                    </Text>
                  </div>

                  <div className="p-4 bg-surface-3 rounded-xl">
                    <Text variant="subtle">
                      Subtle variant - Secondary information
                    </Text>
                  </div>

                  <div className="p-4 bg-surface-3 rounded-xl">
                    <Text variant="muted">
                      Muted variant - Less important details
                    </Text>
                  </div>

                  <div className="p-4 bg-surface-3 rounded-xl">
                    <Text variant="warning">
                      Warning variant - Warning messages
                    </Text>
                  </div>
                </div>
              </div>

              {/* Text Sizes and Weights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-strong">
                    Text Sizes
                  </h3>

                  <div className="p-4 bg-surface-3 rounded-xl space-y-2">
                    <div>
                      <Text size="xs">Extra small text (xs) - 12px</Text>
                    </div>
                    <div>
                      <Text size="sm">Small text (sm) - 14px</Text>
                    </div>
                    <div>
                      <Text size="base">Base text (base) - 16px default</Text>
                    </div>
                    <div>
                      <Text size="lg">Large text (lg) - 18px</Text>
                    </div>
                    <div>
                      <Text size="xl">Extra large text (xl) - 20px</Text>
                    </div>
                    <div>
                      <Text size="2xl">2X large text (2xl) - 24px</Text>
                    </div>
                    <div>
                      <Text size="3xl">3X large text (3xl) - 30px</Text>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-strong">
                    Text Weights
                  </h3>

                  <div className="p-4 bg-surface-3 rounded-xl space-y-2">
                    <div>
                      <Text weight="normal">
                        Normal weight (400) - Default body text
                      </Text>
                    </div>
                    <div>
                      <Text weight="medium">
                        Medium weight (500) - Slightly emphasized
                      </Text>
                    </div>
                    <div>
                      <Text weight="semibold">
                        Semibold weight (600) - Headings
                      </Text>
                    </div>
                    <div>
                      <Text weight="bold">
                        Bold weight (700) - Strong emphasis
                      </Text>
                    </div>
                  </div>
                </div>
              </div>

              {/* Text Alignment & Interaction */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-md font-medium text-strong">
                    Text Alignment
                  </h4>

                  <div className="space-y-2">
                    <div className="p-4 bg-surface-3 rounded-xl">
                      <div style={{ textAlign: 'left' }}>
                        <Text align="left">Left aligned text (default)</Text>
                      </div>
                    </div>

                    <div className="p-4 bg-surface-3 rounded-xl">
                      <div style={{ textAlign: 'center' }}>
                        <Text align="center">Center aligned text</Text>
                      </div>
                    </div>

                    <div className="p-4 bg-surface-3 rounded-xl">
                      <div style={{ textAlign: 'right' }}>
                        <Text align="right">Right aligned text</Text>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-md font-medium text-strong">
                    Interactive Text
                  </h4>

                  <div className="space-y-2">
                    <div className="p-4 bg-surface-3 rounded-xl">
                      <Text
                        onClick={() => alert('Text clicked!')}
                        className="cursor-pointer hover:underline"
                      >
                        Click this text to trigger an action
                      </Text>
                    </div>

                    <div className="p-4 bg-surface-3 rounded-xl">
                      <Text
                        color="var(--accent)"
                        weight="medium"
                        onClick={() => alert('Link clicked!')}
                        className="cursor-pointer hover:underline"
                      >
                        Custom accent color link-style text
                      </Text>
                    </div>
                  </div>
                </div>
              </div>

              {/* Combined Examples */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Combined Properties
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-surface-3 rounded-xl">
                    <div>
                      <Text size="2xl" weight="bold" variant="strong">
                        Large Bold Title
                      </Text>
                    </div>
                    <div className="mt-2">
                      <Text size="sm" variant="subtle">
                        Subtitle with smaller text
                      </Text>
                    </div>
                  </div>

                  <div className="p-4 bg-surface-3 rounded-xl">
                    <div style={{ textAlign: 'center' }}>
                      <Text size="lg" weight="semibold" align="center">
                        Centered Heading
                      </Text>
                    </div>
                    <div style={{ textAlign: 'center' }} className="mt-2">
                      <Text variant="default" align="center">
                        Centered paragraph text below
                      </Text>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Button Primitive */}
          <section
            id="button-primitive"
            className="border border-default rounded-lg p-6 space-y-6"
          >
            <h2 className="text-xl font-semibold text-strong">Button</h2>

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

              {/* 3x1 Grid with only first 2 cells occupied */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className="text-sm text-subtle">Size variants:</p>
                  <div className="p-4 bg-surface-3 rounded-xl">
                    <FlexRow gap="md" align="center">
                      <Button type="primary" size="large" onClick={() => {}}>
                        Large
                      </Button>
                      <Button type="primary" size="normal" onClick={() => {}}>
                        Normal
                      </Button>
                      <Button type="primary" size="small" onClick={() => {}}>
                        Small
                      </Button>
                    </FlexRow>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-subtle">Disabled states:</p>
                  <div className="p-4 bg-surface-3 rounded-xl">
                    <FlexRow gap="md">
                      <Button type="primary" disabled onClick={() => {}}>
                        Disabled Primary
                      </Button>
                      <Button type="secondary" disabled onClick={() => {}}>
                        Disabled Secondary
                      </Button>
                    </FlexRow>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-subtle">Buttons with tooltips:</p>
                  <div className="p-4 bg-surface-3 rounded-xl">
                    <FlexRow gap="md">
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
              </div>
            </div>

            {/* Button with Icons */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                Buttons with Icons
              </h3>

              {/* 3x1 Grid with only first 2 cells occupied */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className="text-sm text-subtle">
                    Button with icon and text:
                  </p>
                  <div className="p-4 bg-surface-3 rounded-xl">
                    <div className="inline-block">
                      <Button type="primary" iconName="plus" onClick={() => {}}>
                        Add Item
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-subtle">Icon-only buttons:</p>
                  <div className="p-4 bg-surface-3 rounded-xl">
                    <FlexRow gap="sm">
                      <Button
                        type="primary"
                        iconName="edit"
                        iconOnly
                        size="small"
                        tooltip="Edit (small)"
                        onClick={() => {}}
                      />
                      <Button
                        type="primary"
                        iconName="edit"
                        iconOnly
                        tooltip="Edit (normal)"
                        onClick={() => {}}
                      />
                      <Button
                        type="primary"
                        iconName="edit"
                        iconOnly
                        size="large"
                        tooltip="Edit (large)"
                        onClick={() => {}}
                      />
                    </FlexRow>
                  </div>
                </div>

                {/* Third cell - empty space */}
                <div></div>
              </div>
            </div>
          </section>

          {/* Section: Modal Primitive */}
          <section
            id="modal-primitive"
            className="border border-default rounded-lg p-6 space-y-6"
          >
            <h2 className="text-xl font-semibold text-strong">Modal</h2>

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
            <h2 className="text-xl font-semibold text-strong">Input</h2>
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
                    onChange={(value: string) => {
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

            {/* Input Variants */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                Input Variants
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Bordered Variant:
                  </label>
                  <Input
                    variant="bordered"
                    placeholder="Bordered input style"
                  />
                  <p className="text-xs text-subtle">
                    Traditional bordered style (explicit variant)
                  </p>
                </div>

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
                    Onboarding Input Test:
                  </label>
                  <Input
                    variant="onboarding"
                    placeholder="Test legacy onChange"
                    onChange={(value: string) =>
                      console.log('Legacy onChange:', value)
                    }
                    className="!bg-white"
                  />
                  <p className="text-xs text-subtle">
                    Tests onboarding variant styling
                    pattern
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Testing Notes */}
            <div className="p-4 rounded-lg">
              <h4 className="font-semibold text-strong mb-2">
              Mobile Testing Notes
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
            <h2 className="text-xl font-semibold text-strong">TextArea</h2>
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

              <div className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    TextArea with Error (type less than 10 chars):
                  </label>
                  <TextArea
                    value={errorTextArea}
                    onChange={(value: string) => {
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

            {/* TextArea Variants */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-strong">
                TextArea Variants
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-strong">
                    Bordered Variant:
                  </label>
                  <TextArea
                    variant="bordered"
                    placeholder="Bordered textarea style..."
                    rows={4}
                  />
                  <p className="text-xs text-subtle">
                    Traditional bordered style (explicit variant)
                  </p>
                </div>

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
            <div className="p-4 rounded-lg">
              <h4 className="font-semibold text-strong mb-2">
              Mobile Testing Notes
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
            <h2 className="text-xl font-semibold text-strong">Switch</h2>
            <p className="text-subtle">
              Cross-platform toggle switch with multiple sizes and variants
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Switch */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Basic Switch
                </h3>

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
                <h3 className="text-lg font-medium text-strong">
                  Switch Sizes
                </h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-strong flex items-center gap-3">
                      <Switch
                        value={switchSizes.small}
                        onChange={(value: boolean) =>
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
                        onChange={(value: boolean) =>
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
                        onChange={(value: boolean) =>
                          setSwitchSizes((prev) => ({ ...prev, large: value }))
                        }
                        size="large"
                      />
                      Large
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Testing Notes */}
            <div className="p-4 bg-surface-1 rounded-lg">
              <h4 className="font-semibold text-strong mb-2">
              Mobile Testing Notes
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
            <h2 className="text-xl font-semibold text-strong">Select</h2>
            <p className="text-subtle">
              Cross-platform dropdown/picker component with rich options and
              customization
            </p>

            {/* All Select Examples in single grid as per screenshot */}
            <h3 className="text-lg font-medium text-strong mb-3">
              Advanced Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Row 1: Advanced Features (all 4 cells) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-strong mb-2 mt-2 block">
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

              <div className="space-y-2">
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

              {/* Row 2: Grouped Options and User Selection (first 2 cells only) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-strong mb-2 block">
                  Grouped Options (SpaceEditor Style)
                </label>
                <Select
                  value=""
                  onChange={() => {}}
                  placeholder="Select a channel"
                  fullWidth
                  groups={[
                    {
                      groupLabel: 'General',
                      options: [
                        { value: 'general', label: '#general' },
                        { value: 'announcements', label: '#announcements' },
                      ],
                    },
                    {
                      groupLabel: 'Development',
                      options: [
                        { value: 'dev-frontend', label: '#dev-frontend' },
                        { value: 'dev-backend', label: '#dev-backend' },
                        { value: 'dev-mobile', label: '#dev-mobile' },
                      ],
                    },
                    {
                      groupLabel: 'Community',
                      options: [
                        { value: 'random', label: '#random' },
                        { value: 'help', label: '#help' },
                      ],
                    },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-strong mb-2 block">
                  User Selection with Avatars
                </label>
                <Select
                  value=""
                  onChange={() => {}}
                  placeholder="Select conversation"
                  fullWidth
                  options={[
                    {
                      value: 'alice',
                      label: 'Alice Johnson',
                      subtitle: '0x1234...5678',
                      avatar: 'https://i.pravatar.cc/150?img=1',
                    },
                    {
                      value: 'bob',
                      label: 'Bob Smith',
                      subtitle: '0x9876...4321',
                      avatar: 'https://i.pravatar.cc/150?img=2',
                    },
                    {
                      value: 'charlie',
                      label: 'Charlie Brown',
                      subtitle: '0xabcd...efgh',
                      avatar: 'https://i.pravatar.cc/150?img=3',
                    },
                  ]}
                />
              </div>

              {/* Empty cells for row 2 */}
              <div></div>
              <div></div>

              {/* Row 3: Dropdown Placement (first 3 cells only) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-strong mb-2 block">
                  Auto Placement
                </label>
                <Select
                  value=""
                  onChange={() => {}}
                  placeholder="Auto placement"
                  dropdownPlacement="auto"
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                    { value: 'option3', label: 'Option 3' },
                  ]}
                />
                <p className="text-xs text-subtle">
                  Automatically positions based on available space
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-strong mb-2 block">
                  Force Bottom
                </label>
                <Select
                  value=""
                  onChange={() => {}}
                  placeholder="Always below"
                  dropdownPlacement="bottom"
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                    { value: 'option3', label: 'Option 3' },
                  ]}
                />
                <p className="text-xs text-subtle">
                  Always opens below (UserSettings style)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-strong mb-2 block">
                  Force Top
                </label>
                <Select
                  value=""
                  onChange={() => {}}
                  placeholder="Always above"
                  dropdownPlacement="top"
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                    { value: 'option3', label: 'Option 3' },
                  ]}
                />
                <p className="text-xs text-subtle">Always opens above</p>
              </div>

              {/* Empty cell for row 3 */}
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
            <h2 className="text-xl font-semibold text-strong">ColorSwatch</h2>
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

              {/* Size Variants, States, and Custom Options in 3x1 Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h4 className="text-md font-medium text-strong">
                    Size Variants
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-subtle w-16">Small:</span>
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
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-subtle w-16">Medium:</span>
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
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-subtle w-16">Large:</span>
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

                <div className="space-y-2">
                  <h4 className="text-md font-medium text-strong">States</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-subtle w-16">Active:</span>
                      <ColorSwatch
                        color="blue"
                        isActive={true}
                        onPress={() => {}}
                      />
                      <span className="text-sm text-muted">
                        Shows checkmark
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-subtle w-16">
                        Disabled:
                      </span>
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

                <div className="space-y-2">
                  <h4 className="text-md font-medium text-strong">
                    Custom Options
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-subtle w-20">
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
            </div>

            {/* Mobile Testing Notes */}
            <div className="p-4 bg-surface-1 rounded-lg">
              <h4 className="font-semibold text-strong mb-2">
              Mobile Testing Notes
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

          {/* Section: RadioGroup Primitive */}
          <section
            id="radiogroup-primitive"
            className="border border-default rounded-lg p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-strong">RadioGroup</h2>
            <p className="text-subtle">
              Accessible radio button group with icon support and flexible
              layouts
            </p>

            {/* RadioGroup Examples in 2x2 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Theme Selection
                </h3>
                <p className="text-sm text-subtle">Using FontAwesome icons:</p>
                <RadioGroup
                  options={[
                    { value: 'light', label: 'Light', icon: 'sun' },
                    { value: 'dark', label: 'Dark', icon: 'moon' },
                    { value: 'system', label: 'System', icon: 'desktop' },
                  ]}
                  value={selectedTheme}
                  onChange={setSelectedTheme}
                  direction="vertical"
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Horizontal Layout
                </h3>
                <p className="text-sm text-subtle">
                  Horizontal layout example:
                </p>
                <RadioGroup
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                    { value: 'option3', label: 'Option 3' },
                  ]}
                  value={selectedSize}
                  onChange={setSelectedSize}
                  direction="horizontal"
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Disabled Options
                </h3>
                <p className="text-sm text-subtle">
                  Some options can be disabled:
                </p>
                <RadioGroup
                  options={[
                    { value: 'basic', label: 'Basic Plan' },
                    { value: 'pro', label: 'Pro Plan', disabled: true },
                    {
                      value: 'enterprise',
                      label: 'Enterprise',
                      disabled: true,
                    },
                  ]}
                  value="basic"
                  onChange={() => {}}
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Without Icons
                </h3>
                <p className="text-sm text-subtle">
                  Simple text-only radio group:
                </p>
                <RadioGroup
                  options={[
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' },
                    { value: 'option3', label: 'Option 3' },
                  ]}
                  value={selectedOption}
                  onChange={setSelectedOption}
                />
              </div>
            </div>

            {/* Mobile Testing Notes */}
            <div className="p-4 bg-surface-1 rounded-lg">
              <h4 className="font-semibold text-strong mb-2">
              Mobile Testing Notes
              </h4>
              <ul className="text-sm text-subtle space-y-1 list-disc list-inside">
                <li>Web: Native HTML radio inputs with custom styling</li>
                <li>
                  Mobile: Custom radio implementation with TouchableOpacity
                </li>
                <li>
                  Icons use emojis temporarily (FontAwesome pending on mobile)
                </li>
                <li>Both horizontal and vertical layouts supported</li>
                <li>Keyboard navigation works on web (Tab, Arrow keys)</li>
                <li>Touch targets optimized for mobile (min 44x44)</li>
                <li>Active state has accent color border and background</li>
                <li>Ready for ThemeRadioGroup integration</li>
              </ul>
            </div>
          </section>

          {/* Section: Tooltip Primitive */}
          <section
            id="tooltip-primitive"
            className="border border-default rounded-lg p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-strong">Tooltip</h2>
            <p className="text-subtle">
              Cross-platform tooltip for information icons in modals and special
              cases
            </p>

            {/* Tooltip Examples */}
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Basic Tooltips
                </h3>
                <div className="flex items-center gap-6 flex-wrap">
                  <Tooltip
                    id="basic-tooltip"
                    content="This is a basic tooltip that appears on hover (desktop) or tap (mobile)"
                    place="top"
                  >
                    <button className="bg-accent text-white px-4 py-2 rounded">
                      Hover/Tap for Info
                    </button>
                  </Tooltip>

                  <Tooltip
                    id="info-icon-tooltip"
                    content="This tooltip simulates the info icons used in UserSettingsModal and SpaceEditor. Click the icon to see the tooltip."
                    place="bottom"
                    maxWidth={300}
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white text-sm cursor-pointer">
                      i
                    </span>
                  </Tooltip>

                  <Tooltip
                    id="long-content-tooltip"
                    content="This is a longer tooltip with more detailed information. It demonstrates how the tooltip handles wrapping text and maintains good readability across different screen sizes. The content automatically adjusts to the specified maximum width."
                    place="right"
                    maxWidth={250}
                  >
                    <button className="bg-surface-5 text-main px-3 py-2 rounded border border-default">
                      Long Content
                    </button>
                  </Tooltip>

                  <Tooltip
                    id="highlighted-tooltip"
                    content="This is a highlighted tooltip with a border"
                    place="top"
                    highlighted={true}
                  >
                    <button className="bg-warning-hex text-white px-3 py-2 rounded">
                      Highlighted
                    </button>
                  </Tooltip>

                  <Tooltip id="short-tooltip" content="Short" place="bottom">
                    <button className="bg-surface-5 text-main px-3 py-2 rounded border border-default">
                      Auto Width
                    </button>
                  </Tooltip>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">Positioning</h3>
                <div className="flex flex-wrap gap-4 justify-center py-8">
                  <Tooltip
                    id="tooltip-top"
                    content="Tooltip positioned at the top"
                    place="top"
                  >
                    <button className="bg-surface-3 px-3 py-2 rounded text-sm">
                      Top
                    </button>
                  </Tooltip>

                  <Tooltip
                    id="tooltip-right"
                    content="Tooltip positioned to the right"
                    place="right"
                  >
                    <button className="bg-surface-3 px-3 py-2 rounded text-sm">
                      Right
                    </button>
                  </Tooltip>

                  <Tooltip
                    id="tooltip-bottom"
                    content="Tooltip positioned at the bottom"
                    place="bottom"
                  >
                    <button className="bg-surface-3 px-3 py-2 rounded text-sm">
                      Bottom
                    </button>
                  </Tooltip>

                  <Tooltip
                    id="tooltip-left"
                    content="Tooltip positioned to the left"
                    place="left"
                  >
                    <button className="bg-surface-3 px-3 py-2 rounded text-sm">
                      Left
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Mobile Testing Notes */}
            <div className="p-4 bg-surface-1 rounded-lg">
              <h4 className="font-semibold text-strong mb-2">
              Mobile Testing Notes
              </h4>
              <ul className="text-sm text-subtle space-y-1 list-disc list-inside">
                <li>Web: Uses existing ReactTooltip with touch support</li>
                <li>Mobile: Custom modal-based tooltip with positioning</li>
                <li>Short tap opens tooltip, tap outside or X button closes</li>
                <li>
                  Tooltips automatically size to content with configurable
                  max-width
                </li>
                <li>Highlighted variant adds border for emphasis</li>
                <li>Automatically positions to stay within screen bounds</li>
                <li>Default close button on mobile for better UX</li>
                <li>
                  Ideal for info icons in UserSettingsModal and SpaceEditor
                </li>
                <li>
                  Supports all 12 positioning options (top, bottom, left, right
                  + variants)
                </li>
              </ul>
            </div>
          </section>

          {/* Section: Icon Primitive */}
          <section
            id="icon-primitive"
            className="border border-default rounded-lg p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-strong">Icon</h2>
            <p className="text-subtle">
              Cross-platform icon system using FontAwesome with unified API
            </p>

            {/* Icon Examples */}
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">Basic Icons</h3>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Icon name="check" />
                    <span className="text-sm text-subtle">check</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="times" />
                    <span className="text-sm text-subtle">times</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="info-circle" />
                    <span className="text-sm text-subtle">info-circle</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="search" />
                    <span className="text-sm text-subtle">search</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="user" />
                    <span className="text-sm text-subtle">user</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="cog" />
                    <span className="text-sm text-subtle">cog</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">Theme Icons</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Icon name="sun" color="#f59e0b" />
                    <span className="text-sm text-subtle">
                      sun (light theme)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="moon" color="#6366f1" />
                    <span className="text-sm text-subtle">
                      moon (dark theme)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="desktop" color="#6b7280" />
                    <span className="text-sm text-subtle">
                      desktop (system)
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">Sizes</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Icon name="heart" size="xs" />
                    <span className="text-sm text-subtle">xs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="heart" size="sm" />
                    <span className="text-sm text-subtle">sm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="heart" size="md" />
                    <span className="text-sm text-subtle">md (default)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="heart" size="lg" />
                    <span className="text-sm text-subtle">lg</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="heart" size="xl"/>
                    <span className="text-sm text-subtle">xl</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="heart" size={32} />
                    <span className="text-sm text-subtle">32px (custom)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Actions & States
                </h3>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Icon name="reply" color="#10b981" />
                    <span className="text-sm text-subtle">reply</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="trash" color="#ef4444" />
                    <span className="text-sm text-subtle">trash</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="link" color="#3b82f6" />
                    <span className="text-sm text-subtle">link</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="spinner" spin />
                    <span className="text-sm text-subtle">
                      spinner (animated)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="bell" disabled />
                    <span className="text-sm text-subtle">bell (disabled)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Navigation Icons
                </h3>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Icon name="chevron-left" />
                    <span className="text-sm text-subtle">chevron-left</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="chevron-right" />
                    <span className="text-sm text-subtle">chevron-right</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="arrow-up" />
                    <span className="text-sm text-subtle">arrow-up</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="arrow-down" />
                    <span className="text-sm text-subtle">arrow-down</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="home" />
                    <span className="text-sm text-subtle">home</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="menu" />
                    <span className="text-sm text-subtle">menu</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Implementation Notes */}
            <div className="bg-surface-1 p-4 rounded-lg">
              <h4 className="font-medium text-strong mb-2">
                Implementation Notes
              </h4>
              <ul className="text-sm text-subtle space-y-1 list-disc list-inside">
                <li>
                  Web: Uses FontAwesome React components with full feature
                  support
                </li>
                <li>
                  Native: Uses react-native-vector-icons with FontAwesome font
                </li>
                <li>Unified API: Same props work across both platforms</li>
                <li>60+ icons mapped from comprehensive codebase audit</li>
                <li>
                  Supports all FontAwesome features: spin, pulse, rotation, etc.
                </li>
                <li>Automatic theme color integration on mobile</li>
                <li>Ready to replace all current FontAwesome usage</li>
              </ul>
            </div>
          </section>

          {/* FileUpload Primitive */}
          <section
            id="fileupload-primitive"
            className="w-full max-w-6xl mx-auto p-8 bg-app border border-default rounded-lg"
          >
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-strong mb-3">
                  FileUpload Primitive
                </h2>
                <p className="text-base text-main">
                  Cross-platform file upload component with drag-and-drop for web
                  and native picker integration for mobile.
                </p>
              </div>

              {/* Image Upload */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">Image Upload</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <p className="text-sm text-subtle">
                      Image upload with drag and drop (web) / image picker (mobile):
                    </p>
                    <FileUpload
                      accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif'] }}
                      onFilesSelected={(files) => {
                        setUploadedFiles(files);
                        setUploadError(null);
                      }}
                      onError={(error) => setUploadError(error.message)}
                      maxSize={2 * 1024 * 1024} // 2MB
                      testId="image-upload"
                      {...({onDragActiveChange: setIsDragActive} as any)}
                    >
                      <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                          isDragActive
                            ? 'border-accent-500 bg-surface-2'
                            : 'border-surface-6 hover:border-accent-300'
                        }`}
                      >
                        <Icon
                          name="file-image"
                          size="xl"
                          className="mx-auto mb-3 text-subtle"
                        />
                        <Text weight="medium" className="mb-3 text-center block">
                          Click or drag to upload image
                        </Text>
                        <Text size="sm" variant="subtle" className="text-center block">
                          PNG, JPG, GIF up to 2MB
                        </Text>
                      </div>
                    </FileUpload>
                  </div>

                  {/* Upload Results */}
                  <div className="space-y-3">
                    <p className="text-sm text-subtle">Upload Results:</p>
                    <div className="bg-surface-3 rounded-lg p-4 space-y-3">
                      {uploadError && (
                        <div className="text-sm" style={{ color: 'var(--color-text-danger)' }}>
                          Error: {uploadError}
                        </div>
                      )}
                      {uploadedFiles.length > 0 ? (
                        <div className="space-y-2">
                          <Text weight="medium">Uploaded Files:</Text>
                          {uploadedFiles.map((file, index) => (
                            <div
                              key={index}
                              className="bg-surface-4 p-3 rounded text-sm space-y-1"
                            >
                              <div>
                                <Text weight="medium">Name:</Text> {file.name}
                              </div>
                              <div>
                                <Text weight="medium">Size:</Text>{' '}
                                {Math.round(file.size / 1024)}KB
                              </div>
                              <div>
                                <Text weight="medium">Type:</Text> {file.type}
                              </div>
                            </div>
                          ))}
                          <Button
                            type="subtle"
                            size="small"
                            onClick={() => {
                              setUploadedFiles([]);
                              setUploadError(null);
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      ) : (
                        <Text variant="subtle" size="sm">
                          No files uploaded yet
                        </Text>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Upload */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-strong">
                  Document Upload
                </h3>
                <div className="space-y-3">
                  <p className="text-sm text-subtle">
                    All file types accepted:
                  </p>
                  <FileUpload
                    accept={{ '*/*': [] }}
                    multiple={true}
                    onFilesSelected={(files) => {
                      setUploadedFiles(files);
                      setUploadError(null);
                    }}
                    onError={(error) => setUploadError(error.message)}
                    maxSize={10 * 1024 * 1024} // 10MB
                    testId="document-upload"
                  >
                    <div className="border-2 border-dashed border-surface-6 rounded-lg p-6 text-center hover:border-accent-300 transition-colors">
                      <Icon
                        name="file-image"
                        size="lg"
                        className="mx-auto mb-2 text-subtle"
                      />
                      <Text weight="medium" className="mb-2 text-center block">
                        Upload any files
                      </Text>
                      <Text size="sm" variant="subtle" className="text-center block">
                        Multiple files, up to 10MB each
                      </Text>
                    </div>
                  </FileUpload>
                </div>
              </div>

              {/* Implementation Details */}
              <div className="bg-surface-2 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-strong mb-3">
                  Implementation Details
                </h3>
                <ul className="text-sm text-main space-y-1 list-disc list-inside">
                  <li>
                    Web: Uses react-dropzone with full drag-and-drop support
                  </li>
                  <li>
                    Native: Uses react-native-document-picker and
                    react-native-image-picker
                  </li>
                  <li>Unified API: Same props work across both platforms</li>
                  <li>File validation: Size limits, MIME type filtering</li>
                  <li>Error handling: Platform-appropriate error messages</li>
                  <li>Accessibility: Full keyboard and screen reader support</li>
                  <li>Performance: No memory leaks, proper cleanup</li>
                </ul>
              </div>
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
