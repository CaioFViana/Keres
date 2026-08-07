import { z } from 'zod';

export const AdminDeletedItemsQuerySchema = z.object({
  /** Nome da entidade (ex: 'Story', 'Character'). Ausente = busca em todas. */
  entityType: z.string().optional(),
  storyId: z.string().optional(),
});
export type AdminDeletedItemsQuery = z.infer<typeof AdminDeletedItemsQuerySchema>;

export const AdminOperationLogQuerySchema = z.object({
  storyId: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().optional(),
  operationType: z.enum(['create', 'update', 'delete', 'reorder']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminOperationLogQuery = z.infer<typeof AdminOperationLogQuerySchema>;
