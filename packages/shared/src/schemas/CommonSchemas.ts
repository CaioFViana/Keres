import { z } from 'zod'

export const ListQuerySchema = z.object({
  isFavorite: z.preprocess((val) => String(val).toLowerCase() === 'true', z.boolean()).optional(),
  hasTags: z.string().optional(),
})

export type ListQueryParams = z.infer<typeof ListQuerySchema>

export const BulkDeleteResponseSchema = z.object({
  successfulIds: z.array(z.string()),
  failedIds: z.array(
    z.object({
      id: z.string(),
      reason: z.string(),
    }),
  ),
})

export type BulkDeleteResponse = z.infer<typeof BulkDeleteResponseSchema>
