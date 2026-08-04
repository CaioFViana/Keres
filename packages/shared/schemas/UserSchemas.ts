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
