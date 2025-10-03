import * as React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { t } from '@lingui/core/macro';
import { Icon, Text, Tooltip } from '@/components/primitives';
import { useCopyToClipboard } from '@/hooks/business/ui/useCopyToClipboard';
import { useTheme } from '@/components/primitives/theme';

type ClickToCopyContentProps = {
  text: string;
  className?: string;
  children: React.ReactNode;
  tooltipText?: string;
  onCopy?: () => void;
  iconClassName?: string;
  noArrow?: boolean;
  tooltipLocation?:
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'right'
    | 'right-start'
    | 'right-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end';
  copyOnContentClick?: boolean;
  iconPosition?: 'left' | 'right';
  touchTrigger?: 'click' | 'long-press';
  longPressDuration?: number;
  textVariant?:
    | 'default'
    | 'strong'
    | 'subtle'
    | 'muted'
    | 'error'
    | 'success'
    | 'warning';
  textSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  iconSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
};

const ClickToCopyContent: React.FunctionComponent<ClickToCopyContentProps> = ({
  text,
  children,
  tooltipText = t`Tap to copy`,
  onCopy,
  noArrow = false,
  tooltipLocation,
  copyOnContentClick = false,
  iconPosition = 'left',
  touchTrigger = 'long-press', // Default to long-press on native
  longPressDuration = 700,
  textVariant,
  textSize,
  iconSize = 'sm',
}) => {
  const theme = useTheme();
  const colors = theme.colors;

  // Use extracted hooks
  const { copied, copyToClipboard } = useCopyToClipboard({
    onCopy,
    timeout: 2000,
    touchTimeout: 3000,
  });

  const [showFeedback, setShowFeedback] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const buttonRef = React.useRef<any>(null);
  const contentRef = React.useRef<any>(null);

  const handleCopy = async () => {
    try {
      // Provide haptic feedback for better UX (Expo Go compatible)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await copyToClipboard(text);

      // Measure element position and show positioned tooltip
      const refToMeasure = buttonRef.current || contentRef.current;
      if (refToMeasure) {
        refToMeasure.measure(
          (
            _x: number,
            _y: number,
            width: number,
            _height: number,
            pageX: number,
            pageY: number
          ) => {
            setTooltipPosition({
              x: pageX + width / 2, // Center above button
              y: pageY - 10, // Above button with small offset
            });

            setShowFeedback(true);

            // Animate in
            Animated.parallel([
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start();
          }
        );
      } else {
        // Fallback if no button ref (copyOnContentClick case) - show centered tooltip
        setTooltipPosition({
          x: 200, // Center of screen approximately
          y: 300, // Middle of screen approximately
        });

        setShowFeedback(true);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }

      // Auto hide after delay
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowFeedback(false);
        });
      }, 1500);
    } catch (error) {
      console.error('Copy failed:', error);
      Alert.alert(t`Copy Failed`, t`Unable to copy to clipboard`);
    }
  };

  const iconElement = (
    <View
      style={[
        styles.iconContainer,
        iconPosition === 'right' ? styles.iconRight : styles.iconLeft,
      ]}
    >
      <Icon
        name="clipboard"
        size={iconSize}
        color={showFeedback ? colors.accent.main : colors.text.subtle}
      />
    </View>
  );

  // Create gesture handlers based on touchTrigger
  const gestureProps = React.useMemo(() => {
    if (touchTrigger === 'long-press') {
      return {
        onLongPress: handleCopy,
        delayLongPress: longPressDuration,
      };
    } else {
      return {
        onPress: handleCopy,
      };
    }
  }, [touchTrigger, longPressDuration]);

  // Wrap icon with tooltip if not copyOnContentClick
  const icon = !copyOnContentClick ? (
    <Tooltip
      content={copied || showFeedback ? t`Copied!` : tooltipText}
      place={tooltipLocation}
      noArrow={noArrow}
    >
      <TouchableOpacity
        ref={buttonRef}
        {...gestureProps}
        style={styles.iconTouchable}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {iconElement}
      </TouchableOpacity>
    </Tooltip>
  ) : (
    iconElement
  );

  const containerContent = (
    <View
      style={[
        styles.container,
        copyOnContentClick && styles.clickableContainer,
      ]}
    >
      {iconPosition === 'left' && icon}
      <Text
        variant={textVariant}
        size={textSize}
        style={[styles.text, copyOnContentClick && styles.clickableText]}
        selectable={!copyOnContentClick}
      >
        {children}
      </Text>
      {iconPosition === 'right' && icon}
    </View>
  );

  // Main content with gestures
  const mainContent = copyOnContentClick ? (
    <TouchableOpacity
      ref={contentRef}
      {...gestureProps}
      style={styles.fullTouchable}
      activeOpacity={0.8}
    >
      {containerContent}
    </TouchableOpacity>
  ) : (
    containerContent
  );

  // Positioned feedback tooltip
  const feedbackTooltip = showFeedback ? (
    <Modal visible={showFeedback} transparent animationType="none">
      <View style={styles.overlayContainer}>
        <Animated.View
          style={[
            styles.tooltipContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
              backgroundColor: colors.bg.tooltip,
              borderColor: colors.border.default,
              position: 'absolute',
              left: tooltipPosition.x - 40, // Center tooltip (assuming ~80px width)
              top: tooltipPosition.y - 40, // Position above button
            },
          ]}
        >
          <Icon name="check" size="xs" color={colors.utilities.success} />
          <Text style={[styles.tooltipText, { color: colors.text.main }]}>
            {t`Copied!`}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  ) : null;

  return (
    <>
      {mainContent}
      {feedbackTooltip}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
  },
  clickableContainer: {
    // Add subtle background when clickable
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    flex: 1,
  },
  clickableText: {
    userSelect: 'none',
  },
  iconContainer: {
    padding: 4,
  },
  iconLeft: {
    marginRight: 4,
  },
  iconRight: {
    marginLeft: 4,
  },
  iconTouchable: {
    padding: 4,
    borderRadius: 4,
  },
  fullTouchable: {
    borderRadius: 6,
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tooltipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    gap: 6,
  },
  tooltipText: {
    fontSize: 14,
    lineHeight: 20, // Match official tooltip line height
    // Remove fontWeight to match official tooltip (default weight)
  },
});

export default ClickToCopyContent;
