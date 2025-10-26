import React, { useMemo } from 'react';
import { Image } from 'react-native';
import { UserInitials } from '../../user/UserInitials';
import { DefaultImages } from '../../../utils';
import { getColorFromDisplayName } from '../../../utils/avatar';
import { SpaceAvatarProps } from './SpaceAvatar.types';

export function SpaceAvatar({
  iconUrl,
  iconData,
  spaceName,
  size = 40,
  testID,
  style,
  onPress
}: SpaceAvatarProps) {
  // Check if there's a valid image (either URL or data, and not the unknown user fallback)
  const hasValidImage = (iconUrl || iconData) &&
    !iconUrl?.includes(DefaultImages.UNKNOWN_USER) &&
    iconData !== null;

  // Memoize color calculation for performance (only recalculates when space name changes)
  const backgroundColor = useMemo(() => getColorFromDisplayName(spaceName), [spaceName]);

  if (hasValidImage) {
    // Prefer iconData over iconUrl (iconData is the base64 data URI)
    const imageSource = iconData || iconUrl;

    return (
      <Image
        testID={testID}
        source={{ uri: imageSource }}
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

  // Fallback to initials when no valid image
  return (
    <UserInitials
      name={spaceName}
      backgroundColor={backgroundColor}
      size={size}
      testID={testID}
      onPress={onPress}
    />
  );
}
