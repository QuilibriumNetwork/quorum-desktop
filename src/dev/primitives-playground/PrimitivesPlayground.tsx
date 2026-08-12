import React, { useState, useEffect, useRef } from 'react';
import {
  Flex,
  Spacer,
  Callout,
  Icon,
  Portal,
  type IconName,
} from '@/components/primitives';
import { ThemeRadioGroup } from '@/components/ui';
import { DevPage, DevPageHeader } from '../shell';
import {
  ButtonExamples,
  CalloutExamples,
  ColorSwatchExamples,
  FileUploadExamples,
  FlexExamples,
  IconExamples,
  InputExamples,
  MentionPillsExamples,
  ModalExamples,
  RadioGroupExamples,
  ScrollContainerExamples,
  SelectExamples,
  SpacerExamples,
  SwitchExamples,
  TextAreaExamples,
  ToastExample,
  TooltipExamples,
  UserInitialsDemo,
} from './examples';

const navigationItems: Array<{ id: string; label: string; icon: IconName }> = [
  { id: 'button-primitive', label: 'Button', icon: 'circle' },
  { id: 'callout-primitive', label: 'Callout', icon: 'info-circle' },
  { id: 'colorswatch-primitive', label: 'ColorSwatch', icon: 'palette' },
  { id: 'container-primitive', label: 'Container', icon: 'square' },
  { id: 'fileupload-primitive', label: 'FileUpload', icon: 'upload' },
  { id: 'flex-primitive', label: 'Flex', icon: 'compress-alt' },
  { id: 'icon-primitive', label: 'Icon', icon: 'star' },
  { id: 'input-primitive', label: 'Input', icon: 'edit' },
  { id: 'mentionpills-demo', label: 'Mention Pills (POC)', icon: 'at' },
  { id: 'modal-primitive', label: 'Modal', icon: 'compress-alt' },
  { id: 'radiogroup-primitive', label: 'RadioGroup', icon: 'radio' },
  { id: 'scrollcontainer-primitive', label: 'ScrollContainer', icon: 'arrow-down' },
  { id: 'select-primitive', label: 'Select', icon: 'chevron-down' },
  { id: 'spacer-primitive', label: 'Spacer', icon: 'minus' },
  { id: 'switch-primitive', label: 'Switch', icon: 'sliders' },
  { id: 'textarea-primitive', label: 'TextArea', icon: 'memo' },
  { id: 'toast-primitive', label: 'Toast', icon: 'bell' },
  { id: 'tooltip-primitive', label: 'Tooltip', icon: 'message-dots' },
  { id: 'user-initials-demo', label: 'User Initials', icon: 'user' },
];

/**
 * Refactored Primitives Playground with modular architecture
 * Each primitive now has its own component with JSON-driven configuration
 */
export const PrimitivesPlayground: React.FC = () => {
  const [activeSection, setActiveSection] = useState('button-primitive');

  // Toast notification state (for testing toast examples in playground)
  const [toast, setToast] = useState<{
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
  } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Scroll to section with offset
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const elementTop = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementTop - 80, // Clears the sticky nav (~45px); the page header no longer sticks
        behavior: 'smooth'
      });
    }
  };

  // Handle initial URL hash navigation
  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove the # symbol
    if (hash && navigationItems.some(item => item.id === hash)) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        scrollToSection(hash);
        setActiveSection(hash);
      }, 100);
    }
  }, []);

  // Update active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 80; // Match the scroll offset

      for (const item of navigationItems) {
        const element = document.getElementById(item.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(item.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Toast event listeners (for testing toast examples)
  useEffect(() => {
    const showToast = (message: string, variant: 'info' | 'success' | 'warning' | 'error') => {
      clearTimeout(toastTimerRef.current);
      setToast({ message, variant });
      toastTimerRef.current = setTimeout(() => setToast(null), 5000);
    };

    const kickHandler = (e: any) => {
      showToast(`You've been kicked from ${e.detail?.spaceName || 'a space'}`, 'warning');
    };

    const genericHandler = (e: any) => {
      showToast(e.detail?.message || 'Notification', e.detail?.variant || 'info');
    };

    (window as any).addEventListener('quorum:kick-toast', kickHandler);
    (window as any).addEventListener('quorum:toast', genericHandler);

    return () => {
      clearTimeout(toastTimerRef.current);
      (window as any).removeEventListener('quorum:kick-toast', kickHandler);
      (window as any).removeEventListener('quorum:toast', genericHandler);
    };
  }, []);

  return (
    <DevPage>
        <DevPageHeader
          icon="flask"
          title="Primitives Playground"
          subtitle="Every primitive, with live props and the full colour system"
        />

      <div className="flex items-start gap-8">
          {/* Components Content */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* Demo */}
            <div>
              <Callout variant="info" className="mb-6">
                Test and validate primitive components. For mobile testing use
                the dedicated playground and the Expo native app.
                <br />
                Click the sliders icon to open interactive props panels and see
                real-time changes!
              </Callout>

              <div className="space-y-28">
                <ButtonExamples />
                <CalloutExamples />
                <ColorSwatchExamples />
                <FileUploadExamples />
                <FlexExamples />
                <IconExamples />
                <InputExamples />
                <MentionPillsExamples />
                <ModalExamples />
                <RadioGroupExamples />
                <ScrollContainerExamples />
                <SelectExamples />
                <SpacerExamples />
                <SwitchExamples />
                <TextAreaExamples />
                <section id="toast-primitive">
                  <ToastExample />
                </section>
                <TooltipExamples />
                <UserInitialsDemo />
              </div>
            </div>
          </div>

          {/* Navigation sidebar. Sticky inside the content column rather than
              `fixed` with a hardcoded `calc((100vw-1536px)/2)` offset, which
              went negative on any viewport under 1536px and pushed the sidebar
              off the right edge. */}
          <aside className="w-72 shrink-0 sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto bg-surface-1 border border-default rounded-lg">
            <div className="p-3">
              {/* Icon-only light/dark/system, in a row. `horizontal` also
                  turns on tooltips, so the row needs no heading. */}
              <div className="mb-4 pb-4 border-b border-default">
                <ThemeRadioGroup horizontal />
              </div>
              <nav className="space-y-1">
                {navigationItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(item.id);
                      window.history.pushState(null, '', `#${item.id}`);
                    }}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors duration-150 flex items-center gap-2 no-underline cursor-pointer ${
                      activeSection === item.id
                        ? 'bg-accent text-white'
                        : 'text-subtle hover:bg-surface-3 hover:text-main'
                    }`}
                  >
                    <Icon name={item.icon} size="sm" />
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
      </div>

      {/* Toast Portal for testing toast examples */}
      {toast && (
        <Portal>
          <div
            className="fixed bottom-4 right-4 max-w-[360px]"
            style={{ zIndex: 2147483647 }}
          >
            <Callout
              variant={toast.variant || 'info'}
              size="sm"
              dismissible
              autoClose={0}
              onClose={() => {
                clearTimeout(toastTimerRef.current);
                setToast(null);
              }}
            >
              {toast.message}
            </Callout>
          </div>
        </Portal>
      )}
    </DevPage>
  );
};
