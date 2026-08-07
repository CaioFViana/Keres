export interface UserPublicInfo {
  id: string;
  username: string;
  tag: string;
  /** Hex color for the user's avatar background. `null` until the user picks one. */
  avatarColor: string | null;
  /** Ionicons glyph name for the user's avatar. `null` until the user picks one. */
  avatarIcon: string | null;
  /** Free-text profile description, up to 200 characters. */
  bio: string | null;
}
