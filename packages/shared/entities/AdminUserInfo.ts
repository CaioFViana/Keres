/**
 * Wider than `UserPublicInfo` (which is deliberately minimal for friend-facing use) -
 * this is what the admin panel's user list/detail views work with.
 */
/** Where the plan a person is on right now comes from. */
export type UserTierSource = 'subscription' | 'assigned' | 'default' | 'none';

export interface AdminUserInfo {
  id: string;
  username: string;
  tag: string;
  avatarColor: string | null;
  avatarIcon: string | null;
  bio: string | null;
  isAdmin: boolean;
  /** The plan an administrator assigned (or the one given at sign-up). A payment never changes it. */
  tierId: string | null;
  /**
   * The plan the person is on right now - the one their paid subscription grants, else the assigned one, else the
   * server's default. What the plan limits are enforced with. Sent by the list and the detail, not by every write.
   */
  effectiveTierId?: string | null;
  /** Why that plan: a paid subscription, the one assigned, the server's default, or none at all. */
  tierSource?: UserTierSource;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
}
