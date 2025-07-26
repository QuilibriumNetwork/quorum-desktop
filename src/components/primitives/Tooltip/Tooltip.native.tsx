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
} from 'react-native';
import { TooltipNativeProps } from './types';
import { useCrossPlatformTheme } from '../theme/ThemeProvider';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function Tooltip({
  content,
  children,
  place = 'top',
  showCloseButton = true, // Default to true on mobile for better UX
  maxWidth = 300,
  disabled = false,
}: TooltipNativeProps) {
  const { colors } = useCrossPlatformTheme();
  
  const [visible, setVisible] = useState(false);
  const [childLayout, setChildLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [tooltipLayout, setTooltipLayout] = useState({ width: 0, height: 0 });
  const childRef = useRef<TouchableOpacity>(null);

  if (disabled) {
    return <>{children}</>;
  }

  const handleChildPress = () => {
    if (childRef.current) {
      childRef.current.measure((_fx: number, _fy: number, width: number, height: number, px: number, py: number) => {
        setChildLayout({ x: px, y: py, width, height });
        setVisible(true);
      });
    }
  };

  const closeTooltip = () => {
    setVisible(false);
  };

  const handleTooltipLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setTooltipLayout({ width, height });
  };

  // Calculate tooltip position based on place prop
  const getTooltipPosition = () => {
    const { x, y, width, height } = childLayout;
    const { width: tooltipWidth, height: tooltipHeight } = tooltipLayout;
    
    const padding = 8;
    let top = 0;
    let left = 0;

    switch (place) {
      case 'top':
      case 'top-start':
      case 'top-end':
        top = y - tooltipHeight - padding;
        left = place === 'top-start' ? x : 
              place === 'top-end' ? x + width - tooltipWidth :
              x + width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
      case 'bottom-start':
      case 'bottom-end':
        top = y + height + padding;
        left = place === 'bottom-start' ? x : 
              place === 'bottom-end' ? x + width - tooltipWidth :
              x + width / 2 - tooltipWidth / 2;
        break;
      case 'left':
      case 'left-start':
      case 'left-end':
        top = place === 'left-start' ? y :
              place === 'left-end' ? y + height - tooltipHeight :
              y + height / 2 - tooltipHeight / 2;
        left = x - tooltipWidth - padding;
        break;
      case 'right':
      case 'right-start':
      case 'right-end':
        top = place === 'right-start' ? y :
              place === 'right-end' ? y + height - tooltipHeight :
              y + height / 2 - tooltipHeight / 2;
        left = x + width + padding;
        break;
      default:
        top = y - tooltipHeight - padding;
        left = x + width / 2 - tooltipWidth / 2;
    }

    // Keep tooltip within screen bounds
    top = Math.max(padding, Math.min(top, screenHeight - tooltipHeight - padding));
    left = Math.max(padding, Math.min(left, screenWidth - tooltipWidth - padding));

    return { top, left };
  };

  const { top, left } = getTooltipPosition();

  // Wrap the child in a TouchableOpacity to handle press
  const touchableChild = React.isValidElement(children) ? (
    <TouchableOpacity ref={childRef} onPress={handleChildPress} activeOpacity={0.7}>
      {children}
    </TouchableOpacity>
  ) : (
    <TouchableOpacity ref={childRef} onPress={handleChildPress} activeOpacity={0.7}>
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
                    backgroundColor: colors.surface[9],
                    borderColor: colors.surface[7],
                    maxWidth,
                    top,
                    left,
                  },
                ]}
                onLayout={handleTooltipLayout}
              >
                <Text style={[styles.content, { color: colors.text.main }]}>
                  {content}
                </Text>
                
                {showCloseButton && (
                  <TouchableOpacity
                    style={[styles.closeButton, { backgroundColor: colors.surface[7] }]}
                    onPress={closeTooltip}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.closeText, { color: colors.text.subtle }]}>
                      ✕
                    </Text>
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
  },
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
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    paddingRight: 20, // Space for close button
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  fallbackText: {
    fontSize: 16,
  },
});