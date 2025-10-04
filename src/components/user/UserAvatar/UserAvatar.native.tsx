import React, { useMemo } from 'react';
import { Image, StyleSheet, ViewStyle } from 'react-native';
import { UserInitials } from '../UserInitials';
import { DefaultImages } from '../../../utils';
import { getColorFromAddress } from '../../../utils/avatar';

interface UserAvatarProps {
  userIcon?: string;
  displayName: string;
  address: string;
  size?: number;
  testID?: string;
  style?: ViewStyle;
  onPress?: () => void;
}

export function UserAvatar({
  userIcon,
  displayName,
  address,
  size = 40,
  testID,
  style,
  onPress
}: UserAvatarProps) {
  const hasValidImage = userIcon && !userIcon.includes(DefaultImages.UNKNOWN_USER);

  // Memoize color calculation for performance (only recalculates when address changes)
  const backgroundColor = useMemo(() => getColorFromAddress(address), [address]);

  if (hasValidImage) {
    return (
      <Image
        testID={testID}
        source={{ uri: userIcon }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          style
        ]}
      />
    );
  }

  return (
    <UserInitials
      name={displayName}
      backgroundColor={backgroundColor}
      size={size}
      testID={testID}
      onPress={onPress}
    />
  );
}
