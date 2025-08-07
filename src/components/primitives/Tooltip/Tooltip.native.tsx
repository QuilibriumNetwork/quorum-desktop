import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  LayoutChangeEvent,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { TooltipNativeProps } from './types';
import { useTheme } from '../theme';
import { Icon } from '../Icon';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function Tooltip({
  content,
  children,
  place = 'top',
  showCloseButton = true, // Default to true on mobile for better UX
  maxWidth = 300,
  disabled = false,
}: TooltipNativeProps) {
  const theme = useTheme();
  const colors = theme.colors;

  const [visible, setVisible] = useState(false);
  const [childLayout, setChildLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [tooltipLayout, setTooltipLayout] = useState({ width: 0, height: 0 });
  const childRef = useRef<any>(null);

  if (disabled) {
    return <>{children}</>;
  }

  const handleChildPress = () => {
    if (childRef.current) {
      childRef.current.measure(
        (
          _fx: number,
          _fy: number,
          width: number,
          height: number,
          px: number,
          py: number
        ) => {
          console.log(
            `[Tooltip ${place}] Element: x=${px}, y=${py}, w=${width}, h=${height}`
          );
          setChildLayout({ x: px, y: py, width, height });
          setVisible(true);
        }
      );
    }
  };

  const closeTooltip = () => {
    setVisible(false);
  };

  const handleTooltipLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    console.log(`[Tooltip ${place}] Tooltip size: w=${width}, h=${height}`);
    setTooltipLayout({ width, height });
  };

  // Calculate tooltip position based on place prop
  const getTooltipPosition = () => {
    const { x, y, width, height } = childLayout;
    const { width: tooltipWidth, height: tooltipHeight } = tooltipLayout;

    const spacing = 8; // Standard spacing
    // Compensate for systematic downward offset (status bar, headers, etc.)
    const verticalOffset = 40; // Adjust this value to compensate for the downward push

    let top = 0;
    let left = 0;

    switch (place) {
      case 'top':
      case 'top-start':
      case 'top-end':
        top = y - tooltipHeight - spacing - verticalOffset; // Compensate for downward push
        left =
          place === 'top-start'
            ? x
            : place === 'top-end'
              ? x + width - tooltipWidth
              : x + width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
      case 'bottom-start':
      case 'bottom-end':
        top = y + height + spacing - verticalOffset; // Compensate for downward push
        left =
          place === 'bottom-start'
            ? x
            : place === 'bottom-end'
              ? x + width - tooltipWidth
              : x + width / 2 - tooltipWidth / 2;
        break;
      case 'left':
      case 'left-start':
      case 'left-end':
        // Better vertical alignment with element center, compensating for offset
        top =
          place === 'left-start'
            ? y - verticalOffset
            : place === 'left-end'
              ? y + height - tooltipHeight - verticalOffset
              : y + height / 2 - tooltipHeight / 2 - verticalOffset; // Center-aligned with element
        left = x - tooltipWidth - spacing;
        break;
      case 'right':
      case 'right-start':
      case 'right-end':
        // Better vertical alignment with element center, compensating for offset
        top =
          place === 'right-start'
            ? y - verticalOffset
            : place === 'right-end'
              ? y + height - tooltipHeight - verticalOffset
              : y + height / 2 - tooltipHeight / 2 - verticalOffset; // Center-aligned with element
        left = x + width + spacing;
        break;
      default:
        top = y - tooltipHeight - spacing - verticalOffset;
        left = x + width / 2 - tooltipWidth / 2;
    }

    // Keep tooltip within screen bounds with minimum padding
    const minPadding = 8;
    const finalTop = Math.max(
      minPadding,
      Math.min(top, screenHeight - tooltipHeight - minPadding)
    );
    const finalLeft = Math.max(
      minPadding,
      Math.min(left, screenWidth - tooltipWidth - minPadding)
    );

    console.log(
      `[Tooltip ${place}] Calculated position: top=${finalTop}, left=${finalLeft}`
    );

    return { top: finalTop, left: finalLeft };
  };

  const { top, left } = getTooltipPosition();

  // Wrap the child in a TouchableOpacity to handle press
  const touchableChild = React.isValidElement(children) ? (
    <TouchableOpacity
      ref={childRef}
      onPress={handleChildPress}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      ref={childRef}
      onPress={handleChildPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.fallbackText, { color: colors.text.main }]}>
        {String(children)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      {touchableChild}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={closeTooltip}
      >
        <TouchableWithoutFeedback onPress={closeTooltip}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.tooltip,
                  {
                    backgroundColor: colors.surface['00'], // Match web --color-bg-tooltip: var(--surface-00)
                    borderColor: colors.surface[6],
                    maxWidth,
                    top,
                    left,
                  },
                ]}
                {...({ onLayout: handleTooltipLayout } as any)}
              >
                <Text style={[styles.content, { color: colors.text.main }]}>
                  {content}
                </Text>

                {showCloseButton && (
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={closeTooltip}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="times" size="xs" color={colors.text.subtle} />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  } as ViewStyle,
  tooltip: {
    position: 'absolute',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  } as ViewStyle,
  content: {
    fontSize: 14,
    lineHeight: 20,
    paddingRight: 20, // Space for close button
  } as TextStyle,
  closeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  } as ViewStyle,
  fallbackText: {
    fontSize: 16,
  } as TextStyle,
});
