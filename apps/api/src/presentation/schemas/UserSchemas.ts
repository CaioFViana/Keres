import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

export const authenticateUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const userProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
