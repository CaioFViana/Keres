import { z } from 'zod'

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(100),
  sort_by: z.string().optional().default('asc'),
  order: z.enum(['asc', 'desc']).optional(),
  isFavorite: z.preprocess((val) => String(val).toLowerCase() === 'true', z.boolean()).optional(),
  hasTags: z.string().optional(),
  filter: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined
      try {
        return val.split(',').reduce((acc, pair) => {
          const [key, value] = pair.split(':')
          if (key && value) {
            acc[key.trim()] = value.trim()
          }
          return acc
        }, {} as Record<string, string>)
      } catch (e) {
        console.error('Error parsing filter string:', e)
        return undefined // Or throw an error if strict parsing is desired
      }
    }),
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

export const ErrorResponseSchema = z.object({
  error: z.string(),
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

const searchQueryTypeValues = [
  'stories',
  'notes',
  'characters',
  'world_rules',
  'locations',
  'chapters',
  'choices',
  'moments',
  'scenes',
  'suggestions',
]

export const SearchQuerySchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
  scope: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : searchQueryTypeValues)),
})

export const SearchResponseSchema = z.array(
  z.object({
    type: z.string(),
    data: z.any(), // This could be more specific, but for now, any is fine
  }),
)

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    totalItems: z.number(),
  })

export type PaginatedResponse<T> = {
  items: T[]
  totalItems: number
}

export const IdParamSchema = z.object({
  id: z.ulid(),
})

export const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
})

export const IncludeQuerySchema = z.object({
  include: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : [])),
})

export const BulkDeleteSchema = z.object({
  ids: z.array(z.ulid()),
})
