import { z } from 'zod';
export declare const GalleryCreateSchema: z.ZodObject<{
    storyId: z.ZodString;
    ownerId: z.ZodString;
    imagePath: z.ZodString;
    isFile: z.ZodOptional<z.ZodBoolean>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const GalleryUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    storyId: z.ZodOptional<z.ZodString>;
    ownerId: z.ZodOptional<z.ZodString>;
    imagePath: z.ZodOptional<z.ZodString>;
    isFile: z.ZodOptional<z.ZodBoolean>;
    isFavorite: z.ZodOptional<z.ZodBoolean>;
    extraNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const GalleryResponseSchema: z.ZodObject<{
    id: z.ZodString;
    storyId: z.ZodString;
    ownerId: z.ZodString;
    imagePath: z.ZodString;
    isFile: z.ZodBoolean;
    isFavorite: z.ZodBoolean;
    extraNotes: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type GalleryCreatePayload = z.infer<typeof GalleryCreateSchema>;
export type GalleryUpdatePayload = z.infer<typeof GalleryUpdateSchema>;
export type GalleryResponse = z.infer<typeof GalleryResponseSchema>;
