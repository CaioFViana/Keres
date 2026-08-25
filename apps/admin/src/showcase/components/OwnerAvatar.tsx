import {
  avatarColorFromSeed,
  DEFAULT_AVATAR_ICON,
  isColorLight,
  type ShowcaseOwner,
} from '@keres/shared';
import avatarIcons from 'virtual:keres-avatar-icons';

/**
 * The same avatar the person picked in the application: the Ionicons icon over their colour.
 *
 * It mirrors `apps/client/src/components/common/display/Avatar/Avatar.tsx` - including the
 * deterministic fallback colour from a seed and the icon tone decided by the background's
 * luminance. The rules come from `@keres/shared`, so the two screens cannot diverge; what is local
 * here is only the SVG drawing, since the site does not have the app's icon font.
 */

/** The icon is semi-transparent over the colour, so the artwork does not compete with it. */
const ICON_TINT_ON_LIGHT = 'rgba(0, 0, 0, 0.6)';
const ICON_TINT_ON_DARK = 'rgba(255, 255, 255, 0.75)';

/** The Ionicons SVGs come in a 512 viewBox. */
const ICON_VIEWBOX = 512;

export function OwnerAvatar({ owner, size = 32 }: { owner: ShowcaseOwner; size?: number }) {
  const background = owner.avatarColor || avatarColorFromSeed(owner.username);
  // An icon this build does not know (a newer app) falls back to the default instead of disappearing.
  const iconMarkup = avatarIcons[owner.avatarIcon ?? ''] ?? avatarIcons[DEFAULT_AVATAR_ICON];
  const tint = isColorLight(background) ? ICON_TINT_ON_LIGHT : ICON_TINT_ON_DARK;
  const inset = size * 0.21;

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background }}
      title={`${owner.username}#${owner.tag}`}
      aria-hidden="true"
    >
      <svg
        width={size - inset * 2}
        height={size - inset * 2}
        viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
        fill={tint}
        // The content comes from the ionicons package, cut out at build time - not from data sent by anyone.
        dangerouslySetInnerHTML={{ __html: iconMarkup }}
      />
    </span>
  );
}
