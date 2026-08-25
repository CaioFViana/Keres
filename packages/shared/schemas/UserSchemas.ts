import { z } from 'zod';

/**
 * Payload for `PUT /user/profile` - the user's own avatar/bio, not the rest of the `users`
 * row (username/tag/password have their own dedicated flows). No `UserSchema` covering the
 * full row exists on purpose: nothing else in the app needs one, and it would either have to
 * carry the password hash or awkwardly omit it.
 */
export const UpdateUserProfileSchema = z.object({
  avatarColor: z.string().nullable().optional(),
  avatarIcon: z.string().nullable().optional(),
  bio: z.string().max(200, 'Bio cannot exceed 200 characters').nullable().optional(),
});

export type UpdateUserProfileType = z.infer<typeof UpdateUserProfileSchema>;

/** Payload for `PUT /user/password` - self-service change, requires the current password. */
export const UpdateUserPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export type UpdateUserPasswordType = z.infer<typeof UpdateUserPasswordSchema>;

/**
 * Payload for `PUT /user/recovery-codes` - regenerates the batch of backup codes, invalidating the
 * previous one. It requires the current password for the same reason as `UpdateUserPasswordSchema`:
 * it is sensitive enough not to be available to whoever only holds the session (token) without
 * knowing the password - even though, unlike changing the password, this is not the only possible
 * defence (see the note in RecoveryCodeService about a compromised session).
 */
export const RegenerateRecoveryCodesSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
});

export type RegenerateRecoveryCodesType = z.infer<typeof RegenerateRecoveryCodesSchema>;
