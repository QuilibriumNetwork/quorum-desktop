import React, { useMemo, useState, useEffect } from 'react';
import { Image, StyleSheet, ViewStyle } from 'react-native';
import { UserInitials } from '../UserInitials';
import { DefaultImages } from '../../../utils';
import { getColorFromDisplayName } from '@quilibrium/quorum-shared';

// A userIcon string can be truthy but not actually renderable: an
// empty/whitespace data URI, the default placeholder, or an empty payload.
// Treat those as "no image" so we fall back to initials instead of a blank
// box. (Native CAN render a local file:// path from this device, so unlike
// web we do NOT reject the file: scheme here — a synced file:// from another
// device simply fails to load and hits onError.)
const isLikelyRenderableImage = (icon?: string): boolean => {
  if (!icon) return false;
  const trimmed = icon.trim();
  if (!trimmed) return false;
  if (trimmed.includes(DefaultImages.UNKNOWN_USER)) return false;
  if (/^data:[^,]*,\s*$/.test(trimmed)) return false;
  return true;
};

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
  const hasValidImage = isLikelyRenderableImage(userIcon);

  // Track runtime image-load failure; on error fall back to initials.
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [userIcon]);

  // Memoize color calculation for performance (only recalculates when display name changes)
  const backgroundColor = useMemo(() => getColorFromDisplayName(displayName), [displayName]);

  if (hasValidImage && !imageFailed) {
    return (
      <Image
        testID={testID}
        source={{ uri: userIcon }}
        onError={() => setImageFailed(true)}
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
