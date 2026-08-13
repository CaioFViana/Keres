import { describe, expect, it } from 'vitest';
import {
  AdminApiLogQuerySchema,
  AdminCreateUserSchema,
  AdminDeletedItemsQuerySchema,
  AdminOperationLogQuerySchema,
  AdminUpdateUserSchema,
  AdminUserListQuerySchema,
  EffectiveStoryRoleEnum,
  FriendshipSchema,
  FriendStatus,
  RegistrationSettingsSchema,
  SharedStoryPermissionTypeEnum,
  StoryAndTargetUserParams,
  TierCreateInputSchema,
  TierUsageSchema,
  UpdateRegistrationSettingsSchema,
  UpdateUserPasswordSchema,
  UpdateUserProfileSchema,
  UpdateUserTagSchema,
} from '../../index';
import { UserTargetIdParam } from '../../schemas/FriendshipRouteSchemas';

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('administrative and account contracts', () => {
  it('defaults paginated admin queries and coerces their URL values', () => {
    expect(AdminOperationLogQuerySchema.parse({ page: '2', pageSize: '30', operationType: 'delete', from: '2025-01-01' })).toMatchObject({ page: 2, pageSize: 30, operationType: 'delete', from: new Date('2025-01-01') });
    expect(AdminApiLogQuerySchema.parse({ level: 'warn' })).toMatchObject({ level: 'warn', page: 1, pageSize: 50 });
    // z.coerce.boolean() follows JavaScript truthiness: route adapters must pass booleans,
    // not literal query strings, when false needs to remain false.
    expect(AdminUserListQuerySchema.parse({ isAdmin: true, isDeleted: false })).toMatchObject({ isAdmin: true, isDeleted: false, page: 1, pageSize: 25 });
    expect(AdminDeletedItemsQuerySchema.parse({ entityType: 'Story', storyId: id })).toEqual({ entityType: 'Story', storyId: id });
    expect(() => AdminApiLogQuerySchema.parse({ pageSize: 201 })).toThrow();
  });

  it('enforces safe administrative user payloads', () => {
    expect(AdminCreateUserSchema.parse({ username: 'ana', password: 'secure-pass' })).toEqual({ username: 'ana', password: 'secure-pass', isAdmin: false });
    expect(AdminUpdateUserSchema.parse({ bio: null, tierId: id, isAdmin: true })).toEqual({ bio: null, tierId: id, isAdmin: true });
    expect(() => AdminCreateUserSchema.parse({ username: '', password: 'short' })).toThrow();
    expect(AdminUpdateUserSchema.parse({ password: 'not-allowed' })).toEqual({});
  });

  it('validates registration, tiers, and user profile contracts', () => {
    expect(UpdateRegistrationSettingsSchema.parse({ autoManage: true, maxUsers: null, defaultTierId: id })).toEqual({ autoManage: true, maxUsers: null, defaultTierId: id });
    expect(RegistrationSettingsSchema.parse({ id: 'singleton', isRegistrationOpen: true, maxUsers: null, autoManage: false, defaultTierId: null, updatedAt: '2025-01-01' }).updatedAt).toBeInstanceOf(Date);
    expect(TierCreateInputSchema.parse({ name: 'Free' })).toEqual({ name: 'Free', isDefault: false });
    expect(TierUsageSchema.parse({ tier: null, storiesUsed: 1, storiesMax: null, storageBytesUsed: 0, storageBytesMax: null })).toMatchObject({ storiesUsed: 1 });
    expect(UpdateUserProfileSchema.parse({ bio: 'bio', avatarColor: null })).toEqual({ bio: 'bio', avatarColor: null });
    expect(UpdateUserPasswordSchema.parse({ currentPassword: 'old', newPassword: 'new-password' })).toMatchObject({ newPassword: 'new-password' });
    expect(UpdateUserTagSchema.parse({ tag: 'caio_1' })).toEqual({ tag: 'caio_1' });
    expect(() => UpdateUserTagSchema.parse({ tag: 'x!' })).toThrow();
  });

  it('defines friendship and story-permission invariants', () => {
    expect(FriendshipSchema.parse({ id, senderId: 'a', receiverId: 'b', createdAt: '2025-01-01', updatedAt: '2025-01-01' })).toMatchObject({ status: FriendStatus.PENDING, blockedById: null });
    expect(() => FriendshipSchema.parse({ id, senderId: 'a', receiverId: 'a', createdAt: '2025-01-01', updatedAt: '2025-01-01' })).toThrow(/cannot be the same/i);
    expect(SharedStoryPermissionTypeEnum.options).toEqual(['reader', 'writer']);
    expect(EffectiveStoryRoleEnum.options).toEqual(['owner', 'writer', 'reader']);
    expect(StoryAndTargetUserParams.parse({ storyId: id, targetUserId: id })).toEqual({ storyId: id, targetUserId: id });
    expect(UserTargetIdParam.parse({ targetUserId: id })).toEqual({ targetUserId: id });
  });
});
