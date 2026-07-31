import { z } from 'zod';

export const UserTargetIdParam = z.object({
  targetUserId: z.string().ulid(),
});