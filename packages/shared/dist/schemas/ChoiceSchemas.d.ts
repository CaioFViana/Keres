import { z } from 'zod';
export declare const CreateChoiceSchema: z.ZodObject<{
    sceneId: z.ZodString;
    nextSceneId: z.ZodString;
    text: z.ZodString;
    isImplicit: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const UpdateChoiceSchema: z.ZodObject<{
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
export type CreateChoicePayload = z.infer<typeof CreateChoiceSchema>;
export type UpdateChoicePayload = z.infer<typeof UpdateChoiceSchema>;
export type ChoiceResponse = z.infer<typeof ChoiceResponseSchema>;
