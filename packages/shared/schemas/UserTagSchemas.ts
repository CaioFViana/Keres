import { z } from 'zod';

/**
 * Short, memorable handle a user shares with friends instead of their raw ULID (e.g.
 * "@caio"). Free of spaces/symbols so it's unambiguous where the tag ends when written
 * with a leading "@" in the UI.
 */
export const UserTagSchema = z.string()
  .min(3, 'Tag must be at least 3 characters')
  .max(20, 'Tag must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Tag can only contain letters, numbers, and underscores');

export const UpdateUserTagSchema = z.object({
  tag: UserTagSchema,
});
