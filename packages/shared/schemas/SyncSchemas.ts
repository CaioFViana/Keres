// packages/shared/entities/sync/SyncSchemas.ts
import { z } from 'zod';

// Define a Zod schema for ULID strings
export const UlidSchema = z.string().regex(/^[0-9A-Z]{26}$/, 'Invalid ULID format');

// 1. Define o tipo de operação de sincronização
export const StoryUpdateTypeSchema = z.enum(['create', 'update', 'delete']);
export type StoryUpdateType = z.infer<typeof StoryUpdateTypeSchema>;

// 2. Schema base para qualquer StoryUpdate
// Contém campos comuns a todas as operações
export const BaseStoryUpdateSchema = z.object({
  entity: z.string().min(1, 'Entity name cannot be empty'), // Nome da entidade (ex: 'Story', 'Character')
  // O ID é opcional aqui porque 'create' não terá um ID ainda
  id: UlidSchema.optional(),
  // A versão do *entidade* é crucial para o controle de concorrência e LWW
  version: z.number().int().min(0).optional(),
  // A versão da *operação* no log de operações do servidor
  operationVersion: z.number().int().min(0).optional(),
}).extend({
  operationTime: z.date().optional(), // Add operationTime
  originatingUser: z.string().optional(), // Add originatingUser
});

// 3. Schema para operações de criação
export const CreateStoryUpdateSchema = BaseStoryUpdateSchema.extend({
  type: z.literal('create'),
  // 'data' contém o objeto completo da nova entidade
  data: z.record(z.string(), z.any()), // Placeholder, pode ser mais específico depois
});
export type CreateStoryUpdate = z.infer<typeof CreateStoryUpdateSchema>;

// 4. Schema para operações de atualização
export const UpdateStoryUpdateSchema = BaseStoryUpdateSchema.extend({
  type: z.literal('update'),
  id: UlidSchema, // ID é obrigatório para atualizações
  // 'changes' contém apenas os campos que foram alterados
  changes: z.record(z.string(), z.any()), // Placeholder, pode ser mais específico depois
});
export type UpdateStoryUpdate = z.infer<typeof UpdateStoryUpdateSchema>;

// 5. Schema para operações de exclusão
export const DeleteStoryUpdateSchema = BaseStoryUpdateSchema.extend({
  type: z.literal('delete'),
  id: UlidSchema, // ID é obrigatório para exclusões
});
export type DeleteStoryUpdate = z.infer<typeof DeleteStoryUpdateSchema>;

// Define a Zod schema for the items within the reorder update
export const ReorderItemSchema = z.object({
  id: UlidSchema,
  newIndex: z.number().int().min(1),
});

// 6. Schema para operações de reordenação de cenas dentro de um capítulo
export const ChapterReorderingStoryUpdateSchema = BaseStoryUpdateSchema.extend({
  type: z.literal('reorder'),
  entity: z.literal('Chapter'), // Entity to which reorderItems belong
  id: UlidSchema, // ID of the Chapter whose scenes are being reordered
  reorderItems: z.array(ReorderItemSchema), // Array of scene IDs and their new indices
});
export type ChapterReorderingStoryUpdate = z.infer<typeof ChapterReorderingStoryUpdateSchema>;

// 7. Schema para operações de reordenação de capítulos dentro de uma história
export const StoryReorderingStoryUpdateSchema = BaseStoryUpdateSchema.extend({
  type: z.literal('reorder'),
  entity: z.literal('Story'), // Entity to which reorderItems belong
  id: UlidSchema, // ID of the Story whose chapters are being reordered
  reorderItems: z.array(ReorderItemSchema), // Array of chapter IDs and their new indices
});
export type StoryReorderingStoryUpdate = z.infer<typeof StoryReorderingStoryUpdateSchema>;

// 8. Union type para todas as operações de StoryUpdate
export const StoryUpdateSchema = z.union([
  CreateStoryUpdateSchema,
  UpdateStoryUpdateSchema,
  DeleteStoryUpdateSchema,
  ChapterReorderingStoryUpdateSchema,
  StoryReorderingStoryUpdateSchema,
]);
export type StoryUpdate = z.infer<typeof StoryUpdateSchema>;

// 9. Schema para um array de StoryUpdates (o que o servidor receberá)
export const StoryUpdatesArraySchema = z.array(StoryUpdateSchema);
export type StoryUpdatesArray = z.infer<typeof StoryUpdatesArraySchema>;
