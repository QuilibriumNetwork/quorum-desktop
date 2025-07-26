import { Platform } from 'react-native';
import { Tooltip as TooltipWeb } from './Tooltip.web';
import { Tooltip as TooltipNative } from './Tooltip.native';

export const Tooltip = Platform.select({
  web: TooltipWeb,
  default: TooltipNative,
});