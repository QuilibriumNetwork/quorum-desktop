import React, { useState } from 'react';
import {
  Container,
  FlexRow,
  FlexColumn,
  Text,
  Spacer,
  Callout,
  Icon,
} from '@/components/primitives';
import ThemeRadioGroup from '@/components/ThemeRadioGroup';
import AccentColorSwitcher from '@/components/AccentColorSwitcher';
import { DevNavMenu } from '../DevNavMenu';
import {
  ButtonExamples,
  CalloutExamples,
  ColorSwatchExamples,
  ContainerExamples,
  FileUploadExamples,
  FlexColumnExamples,
  FlexRowExamples,
  IconExamples,
  InputExamples,
  ModalExamples,
  RadioGroupExamples,
  ScrollContainerExamples,
  SelectExamples,
  SpacerExamples,
  SwitchExamples,
  TextExamples,
  TextAreaExamples,
  TooltipExamples,
} from './examples';

const navigationItems = [
  { id: 'button-primitive', label: 'Button', icon: 'circle' },
  { id: 'callout-primitive', label: 'Callout', icon: 'info' },
  { id: 'colorswatch-primitive', label: 'ColorSwatch', icon: 'palette' },
  { id: 'container-primitive', label: 'Container', icon: 'square' },
  { id: 'fileupload-primitive', label: 'FileUpload', icon: 'upload' },
  { id: 'flexcolumn-primitive', label: 'FlexColumn', icon: 'bars' },
  { id: 'flex-primitives', label: 'FlexRow', icon: 'menu' },
  { id: 'icon-primitive', label: 'Icon', icon: 'star' },
  { id: 'input-primitive', label: 'Input', icon: 'edit' },
  { id: 'modal-primitive', label: 'Modal', icon: 'compress-alt' },
  { id: 'radiogroup-primitive', label: 'RadioGroup', icon: 'dot-circle' },
  { id: 'scrollcontainer-primitive', label: 'ScrollContainer', icon: 'arrow-down' },
  { id: 'select-primitive', label: 'Select', icon: 'chevron-down' },
  { id: 'spacer-primitive', label: 'Spacer', icon: 'minus' },
  { id: 'switch-primitive', label: 'Switch', icon: 'sliders' },
  { id: 'text-primitive', label: 'Text', icon: 'pencil' },
  { id: 'textarea-primitive', label: 'TextArea', icon: 'memo' },
  { id: 'tooltip-primitive', label: 'Tooltip', icon: 'circle-info' },
];

/**
 * Refactored Primitives Playground with modular architecture
 * Each primitive now has its own component with JSON-driven configuration
 */
export const PrimitivesPlayground: React.FC = () => {
  const [activeSection, setActiveSection] = useState('button-primitive');

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <DevNavMenu currentPath="/playground" sticky />

      {/* Header - constrained width */}
      <div className="sticky top-[41px] z-10 bg-surface-00 p-6 pr-8 -mt-px">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Primitives Playground</h1>
          </div>

          {/* Theme and Color Controls - horizontal like old playground */}
          <div className="flex items-center gap-6 ml-auto">
            <ThemeRadioGroup horizontal />
            <AccentColorSwitcher />
          </div>
        </div>
      </div>

      {/* Full width background area below header */}
      <div className="flex flex-1 overflow-hidden bg-surface-0">
        {/* Constrained content container inside full-width bg */}
        <div className="max-w-screen-2xl mx-auto w-full flex">
          {/* Components Content */}
          <div className="flex-1 p-8 space-y-8 overflow-y-auto pr-80">
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
                <ContainerExamples />
                <FileUploadExamples />
                <FlexColumnExamples />
                <FlexRowExamples />
                <IconExamples />
                <InputExamples />
                <ModalExamples />
                <RadioGroupExamples />
                <ScrollContainerExamples />
                <SelectExamples />
                <SpacerExamples />
                <SwitchExamples />
                <TextExamples />
                <TextAreaExamples />
                <TooltipExamples />
              </div>
            </div>
          </div>

          {/* Navigation Sidebar - fixed positioned */}
          <div className="fixed right-[calc((100vw-1536px)/2)] top-[150px] w-72 h-[calc(100vh-155px)] bg-surface-0 border-l border-default overflow-y-auto z-10">
            <div className="p-4">
              <nav className="space-y-2">
                {navigationItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`cursor-pointer px-3 py-2 mt-6 rounded-lg text-sm transition-colors duration-150 flex items-center gap-2 ${
                      activeSection === item.id
                        ? 'bg-accent text-white'
                        : 'text-subtle hover:bg-surface-3 hover:text-main'
                    }`}
                  >
                    <Icon name={item.icon} size="sm" />
                    {item.label}
                  </div>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
