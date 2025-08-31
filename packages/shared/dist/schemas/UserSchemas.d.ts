import { z } from 'zod';
export declare const UserRegisterSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const UserLoginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const UserProfileSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type UserRegisterPayload = z.infer<typeof UserRegisterSchema>;
export type UserLoginPayload = z.infer<typeof UserLoginSchema>;
export type UserProfileResponse = z.infer<typeof UserProfileSchema>;
