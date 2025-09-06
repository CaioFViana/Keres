import { z } from 'zod'

export const ListQuerySchema = z.object({
  isFavorite: z.preprocess((val) => String(val).toLowerCase() === 'true', z.boolean()).optional(),
  hasTags: z.string().optional(),
})

export type ListQueryParams = z.infer<typeof ListQuerySchema>
