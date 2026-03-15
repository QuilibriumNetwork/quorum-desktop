import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { CalloutNativeProps } from './types';
import { Icon } from '../Icon';
import { IconName } from '../Icon/types';
import { useTheme } from '../theme';

const variantIcons: Record<string, IconName> = {
  info: 'info-circle',
  success: 'check',
  warning: 'warning',
  error: 'warning',
};

const getVariantStyles = (
  variant: string,
  layout: string,
  colors: any
) => {
  const variantColorMap: Record<string, string> = {
    info: colors.utilities.info,
    success: colors.utilities.success,
    warning: colors.utilities.warning,
    error: colors.utilities.danger,
  };

  const textColor = variantColorMap[variant] || colors.utilities.info;

  if (layout === 'base') {
    return {
      container: {
        borderColor: textColor + '4D',
        backgroundColor: textColor + '1A',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
      },
      text: { color: textColor },
      icon: { color: textColor },
    };
  }

  return {
    container: {},
    text: { color: textColor },
    icon: { color: textColor },
  };
};

const sizeStyles = {
  xs: {
    fontSize: 12,
    lineHeight: 16,
  },
  sm: {
    fontSize: 14,
    lineHeight: 20,
  },
  md: {
    fontSize: 16,
    lineHeight: 24,
  },
};

const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
};

const Callout: React.FC<CalloutNativeProps> = ({
  variant,
  children,
  size = 'sm',
  layout = 'base',
  dismissible = false,
  autoClose,
  onClose,
  testID,
}) => {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (autoClose && autoClose > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoClose * 1000);

      return () => clearTimeout(timer);
    }
  }, [autoClose]);

  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      onClose?.();
    });
  };

  if (!isVisible) return null;

  const variantStyle = getVariantStyles(variant, layout, theme.colors);
  const textSize = sizeStyles[size];
  const iconSize = iconSizes[size];

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.container,
        variantStyle.container,
        { opacity: fadeAnim },
      ]}
    >
      <Icon
        name={variantIcons[variant]}
        size={iconSize}
        color={variantStyle.icon.color}
        style={styles.icon}
      />
      <View style={styles.content}>
        {typeof children === 'string' ? (
          <Text style={[textSize, variantStyle.text]}>{children}</Text>
        ) : (
          children
        )}
      </View>
      {dismissible && (
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon
            name="close"
            size={iconSize}
            color={variantStyle.icon.color}
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  icon: {
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  closeButton: {
    marginLeft: 8,
  },
});

export default Callout;