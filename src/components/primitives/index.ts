/**
 * Primitives barrel export
 *
 * Components and types are provided by @quilibrium/quorum-shared.
 * SCSS styles remain local — imported here so the web bundler picks them up.
 */

// SCSS imports (web only — bundler handles these, ignored on native)
import './Button/Button.scss';
import './Callout/Callout.scss';
import './ColorSwatch/ColorSwatch.scss';
import './Icon/Icon.scss';
import './Input/Input.scss';
import './Modal/Modal.scss';
import './RadioGroup/RadioGroup.scss';
import './Select/Select.scss';
import './Switch/Switch.scss';
import './Text/Text.scss';
import './TextArea/TextArea.scss';

// Re-export all primitives from quorum-shared
export {
  // Layout
  OverlayBackdrop,
  Portal,
  Flex,
  Spacer,
  ScrollContainer,
  // UI
  Button,
  Modal,
  Input,
  TextArea,
  Select,
  Switch,
  ColorSwatch,
  RadioGroup,
  Tooltip,
  Icon,
  iconNames,
  isValidIconName,
  Text,
  Paragraph,
  Label,
  Caption,
  Title,
  InlineText,
  FileUpload,
  Callout,
  // Theme
  ThemeProvider,
  useTheme,
  getColors,
} from '@quilibrium/quorum-shared';

// Re-export all types from quorum-shared
export type {
  // Layout types
  OverlayBackdropProps,
  FlexProps,
  SpacerProps,
  SpacerSize,
  SpacerDirection,
  ScrollContainerProps,
  WebScrollContainerProps,
  NativeScrollContainerProps,
  ScrollContainerHeight,
  ScrollContainerBorderRadius,
  // UI types
  ButtonProps,
  ModalProps,
  InputProps,
  InputNativeProps,
  TextAreaProps,
  TextAreaNativeProps,
  SelectProps,
  WebSelectProps,
  NativeSelectProps,
  SelectOption,
  SelectOptionGroup,
  SwitchProps,
  BaseSwitchProps,
  ColorSwatchProps,
  ColorSwatchWebProps,
  ColorSwatchNativeProps,
  RadioGroupProps,
  RadioGroupWebProps,
  RadioGroupNativeProps,
  RadioOption,
  TooltipProps,
  TooltipWebProps,
  TooltipNativeProps,
  TooltipPlacement,
  IconProps,
  IconWebProps,
  IconNativeProps,
  IconName,
  IconSize,
  IconVariant,
  TextProps,
  WebTextProps,
  NativeTextProps,
  FileUploadProps,
  FileUploadFile,
  CalloutProps,
  CalloutVariant,
  CalloutSize,
  CalloutLayout,
  // Theme types
  Theme,
  AccentColor,
} from '@quilibrium/quorum-shared';
