import { z } from 'zod';
export declare const ChoiceCreateSchema: z.ZodObject<{
    sceneId: z.ZodString;
    nextSceneId: z.ZodString;
    text: z.ZodString;
    isImplicit: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const ChoiceUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    sceneId: z.ZodOptional<z.ZodString>;
    nextSceneId: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    isImplicit: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const ChoiceResponseSchema: z.ZodObject<{
    id: z.ZodString;
    sceneId: z.ZodString;
    nextSceneId: z.ZodString;
    text: z.ZodString;
    isImplicit: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type ChoiceCreatePayload = z.infer<typeof ChoiceCreateSchema>;
export type ChoiceUpdatePayload = z.infer<typeof ChoiceUpdateSchema>;
export type ChoiceResponse = z.infer<typeof ChoiceResponseSchema>;
