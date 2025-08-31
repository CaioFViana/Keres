import { z } from 'zod';
export const UserRegisterSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters long'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
});
export const UserLoginSchema = z.object({
    username: z.string(),
    password: z.string(),
});
export const UserProfileSchema = z.object({
    id: z.string(),
    username: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
});
