import { avatarColorFromSeed, DEFAULT_AVATAR_ICON } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { isColorLight } from '../../../../theme/commonStyles';

/**
 * The default icon, the fallback palette and the colour seed live in `@keres/shared`: the public site
 * draws exactly the same avatar for whoever published a story, and two copies of the same rules would
 * end up diverging.
 */

/**
 * The original semi-transparent grey was barely visible on several of the palette's background
 * colours - black or white (also semi-transparent, for the original request's "grey/transparent")
 * guarantee contrast on any chosen colour, decided by the same luminance that already guides text over
 * colour in the rest of the app (`isColorLight`, used by Tag).
 */
const ICON_TINT_ON_LIGHT = 'rgba(0, 0, 0, 0.6)';
const ICON_TINT_ON_DARK = 'rgba(255, 255, 255, 0.75)';

export interface AvatarProps {
  /** The background colour the user picked; `null`/absent falls back to the deterministic one. */
  color?: string | null;
  /** The name of the Ionicons icon picked; `null`/absent falls back to the default icon. */
  icon?: string | null;
  /** Only used when no `color` was chosen, to generate a stable fallback (an id or a username). */
  seed: string;
  size?: number;
}

const Avatar: React.FC<AvatarProps> = ({ color, icon, seed, size = 40 }) => {
  const backgroundColor = color || avatarColorFromSeed(seed);
  const iconName = (icon as keyof typeof Ionicons.glyphMap) || DEFAULT_AVATAR_ICON;
  const iconTint = isColorLight(backgroundColor) ? ICON_TINT_ON_LIGHT : ICON_TINT_ON_DARK;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={iconName} size={size * 0.58} color={iconTint} />
    </View>
  );
};

export default Avatar;
