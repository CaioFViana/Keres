/**
 * Wider than `UserPublicInfo` (which is deliberately minimal for friend-facing use) -
 * this is what the admin panel's user list/detail views work with.
 */
export interface AdminUserInfo {
  id: string;
  username: string;
  tag: string;
  avatarColor: string | null;
  avatarIcon: string | null;
  bio: string | null;
  isAdmin: boolean;
  tierId: string | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
}
