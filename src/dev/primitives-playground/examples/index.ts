// Example Components (Alphabetically Ordered)
export { ButtonExamples } from './Button';
export { CalloutExamples } from './Callout';
export { ColorSwatchExamples } from './ColorSwatch';
export { ContainerExamples } from './Container';
export { FileUploadExamples } from './FileUpload';
export { FlexColumnExamples } from './FlexColumn';
export { FlexRowExamples } from './FlexRow';
export { IconExamples } from './Icon';
export { InputExamples } from './Input';
export { MentionPillsExamples } from './MentionPills';
export { ModalExamples } from './Modal';
export { RadioGroupExamples } from './RadioGroup';
export { ScrollContainerExamples } from './ScrollContainer';
export { SelectExamples } from './Select';
export { SpacerExamples } from './Spacer';
export { SwitchExamples } from './Switch';
export { TextExamples } from './Text';
export { TextAreaExamples } from './TextArea';
export { ToastExample } from './ToastExample';
export { TooltipExamples } from './Tooltip';
export { UserInitialsDemo } from './UserInitialsDemo';

// Navigation Metadata (Alphabetically Ordered)
export const navigationItems = [
  { id: 'button-primitive', label: 'Button', component: 'ButtonExamples' },
  { id: 'callout-primitive', label: 'Callout', component: 'CalloutExamples' },
  { id: 'colorswatch-primitive', label: 'ColorSwatch', component: 'ColorSwatchExamples' },
  { id: 'container-primitive', label: 'Container', component: 'ContainerExamples' },
  { id: 'fileupload-primitive', label: 'FileUpload', component: 'FileUploadExamples' },
  { id: 'flexcolumn-primitive', label: 'FlexColumn', component: 'FlexColumnExamples' },
  { id: 'flex-primitives', label: 'FlexRow', component: 'FlexRowExamples' },
  { id: 'icon-primitive', label: 'Icon', component: 'IconExamples' },
  { id: 'input-primitive', label: 'Input', component: 'InputExamples' },
  { id: 'modal-primitive', label: 'Modal', component: 'ModalExamples' },
  { id: 'radiogroup-primitive', label: 'RadioGroup', component: 'RadioGroupExamples' },
  { id: 'scrollcontainer-primitive', label: 'ScrollContainer', component: 'ScrollContainerExamples' },
  { id: 'select-primitive', label: 'Select', component: 'SelectExamples' },
  { id: 'spacer-primitive', label: 'Spacer', component: 'SpacerExamples' },
  { id: 'switch-primitive', label: 'Switch', component: 'SwitchExamples' },
  { id: 'text-primitive', label: 'Text', component: 'TextExamples' },
  { id: 'textarea-primitive', label: 'TextArea', component: 'TextAreaExamples' },
  { id: 'toast-primitive', label: 'Toast', component: 'ToastExample' },
  { id: 'tooltip-primitive', label: 'Tooltip', component: 'TooltipExamples' },
];

// Component Registry for Dynamic Rendering (Alphabetically Ordered)
export const componentRegistry = {
  ButtonExamples: () => import('./Button').then(m => m.ButtonExamples),
  CalloutExamples: () => import('./Callout').then(m => m.CalloutExamples),
  ColorSwatchExamples: () => import('./ColorSwatch').then(m => m.ColorSwatchExamples),
  ContainerExamples: () => import('./Container').then(m => m.ContainerExamples),
  FileUploadExamples: () => import('./FileUpload').then(m => m.FileUploadExamples),
  FlexColumnExamples: () => import('./FlexColumn').then(m => m.FlexColumnExamples),
  FlexRowExamples: () => import('./FlexRow').then(m => m.FlexRowExamples),
  IconExamples: () => import('./Icon').then(m => m.IconExamples),
  InputExamples: () => import('./Input').then(m => m.InputExamples),
  ModalExamples: () => import('./Modal').then(m => m.ModalExamples),
  RadioGroupExamples: () => import('./RadioGroup').then(m => m.RadioGroupExamples),
  ScrollContainerExamples: () => import('./ScrollContainer').then(m => m.ScrollContainerExamples),
  SelectExamples: () => import('./Select').then(m => m.SelectExamples),
  SpacerExamples: () => import('./Spacer').then(m => m.SpacerExamples),
  SwitchExamples: () => import('./Switch').then(m => m.SwitchExamples),
  TextExamples: () => import('./Text').then(m => m.TextExamples),
  TextAreaExamples: () => import('./TextArea').then(m => m.TextAreaExamples),
  ToastExample: () => import('./ToastExample').then(m => m.ToastExample),
  TooltipExamples: () => import('./Tooltip').then(m => m.TooltipExamples),
};