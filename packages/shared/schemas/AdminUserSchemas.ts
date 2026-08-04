import { z } from 'zod';
import { UlidSchema } from './SyncSchemas';

export const AdminCreateUserSchema = z.object({
  username: z.string().min(1, 'Username cannot be empty'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  /** Defaults to `username` if omitted, same fallback as self-service registration. */
  tag: z.string().min(1).optional(),
  isAdmin: z.boolean().default(false),
  tierId: UlidSchema.nullable().optional(),
});
export type AdminCreateUser = z.infer<typeof AdminCreateUserSchema>;

/**
 * Deliberately excludes `password` - resetting a user's password is a separate,
 * explicit action, not something that should be silently possible through a generic
 * profile PATCH.
 */
export const AdminUpdateUserSchema = z.object({
  isAdmin: z.boolean().optional(),
  tierId: UlidSchema.nullable().optional(),
  tag: z.string().min(1).optional(),
  avatarColor: z.string().nullable().optional(),
  avatarIcon: z.string().nullable().optional(),
  bio: z.string().max(200).nullable().optional(),
});
export type AdminUpdateUser = z.infer<typeof AdminUpdateUserSchema>;

export const AdminUserListQuerySchema = z.object({
  search: z.string().optional(),
  isAdmin: z.coerce.boolean().optional(),
  isDeleted: z.coerce.boolean().optional(),
  tierId: UlidSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;
