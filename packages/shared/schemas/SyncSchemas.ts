// packages/shared/entities/sync/SyncSchemas.ts
import { z } from 'zod';

// Define a Zod schema for ULID strings
export const UlidSchema = z.string().regex(/^[0-9A-Z]{26}$/, 'Invalid ULID format');

// 1. Define o tipo de operação de sincronização
export const StoryUpdateTypeSchema = z.enum(['create', 'update', 'delete', 'reorder']); // Added 'reorder'
export type StoryUpdateType = z.infer<typeof StoryUpdateTypeSchema>;

// 2. Schema base para qualquer StoryUpdate
// Contém campos comuns a todas as operações
export const BaseStoryUpdateSchema = z
  .object({
    entity: z.string().min(1, 'Entity name cannot be empty'), // Nome da entidade (ex: 'Story', 'Character')
    // O ID é opcional aqui porque 'create' não terá um ID ainda
    id: UlidSchema.optional(),
    /**
     * A versão da *entidade*, base do controle de concorrência otimista.
     *
     * O campo é direcional:
     * - push (cliente -> servidor): é a versão que o cliente leu ANTES de aplicar a
     *   mudança (a "base"). O servidor rejeita a operação se a sua própria versão
     *   divergir dessa base, porque isso significa que alguém escreveu no meio.
     * - pull (servidor -> cliente): é a versão da entidade DEPOIS da operação, para
     *   que o cliente saiba em que base as próximas edições dele se apoiam.
     *
     * ATENÇÃO, para operações `update`: quem o servidor lê como base é `changes.version`,
     * não este campo (ver `BaseSyncEntityHandler.checkVersionConflict`, alimentado por
     * `update.changes.version`). Este aqui continua sendo preenchido e é o que a resposta
     * de conflito ecoa, mas um push que traga só ele e omita `changes.version` não é
     * comparado com nada: o servidor aceita a escrita, e a detecção de conflito daquela
     * operação simplesmente não acontece. `SyncEngineService` duplica o valor nos dois
     * lugares justamente por isso.
     *
     * Nunca deve receber a versão da *operação* (`operationVersion`): são contadores
     * diferentes e confundi-los desliga a detecção de conflitos.
     */
    version: z.number().int().min(0).optional(),
    // A versão da *operação* no log de operações do servidor
    operationVersion: z.number().int().min(0).optional(),
  })
  .extend({
    operationTime: z.string().datetime().optional(), // CHANGED: Expect ISO string, as per user's instruction
    originatingUser: z.string().optional(),
    /**
     * Id da linha do log de operações *local do cliente*. Enviado no push e devolvido
     * intacto na resposta, para que o cliente saiba exatamente quais operações foram
     * aplicadas e quais conflitaram, em vez de tratar o lote como tudo-ou-nada.
     */
    clientOperationId: z.string().optional(),
    /**
     * Id da linha do log de operações *do servidor*. Preenchido no pull para que o
     * cliente possa gravar a operação remota de forma idempotente (re-pulls não
     * duplicam nem colidem no log local).
     */
    operationId: z.string().optional(),
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
  reorderTarget: z.literal('StorySchemaField').optional(),
  schemaEntityType: z.string().min(1).optional(),
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

// 10. Resultado por operação de um push
//
// O push deixou de ser tudo-ou-nada: cada operação é aplicada isoladamente e o
// servidor devolve o que passou e o que conflitou. Sem isso o cliente não tem como
// distinguir "o servidor recusou a minha edição" de "o lote inteiro falhou", e acaba
// marcando operações recusadas como sincronizadas (perdendo o trabalho do usuário)
// ou reenviando-as para sempre.

/** Por que o servidor recusou a operação. Determina o que a tela de conflito oferece. */
export const SyncConflictReasonSchema = z.enum([
  /** A base enviada pelo cliente não é a versão atual do servidor: alguém editou no meio. */
  'version_conflict',
  /** A entidade não existe no servidor (nunca chegou lá, ou foi removida em definitivo). */
  'not_found',
  /** A entidade foi excluída no servidor, mas o cliente ainda a estava editando. */
  'deleted_on_server',
  /** A entidade foi editada no servidor, mas o cliente a excluiu localmente. */
  'edited_on_server',
  /** O cliente e o servidor mudaram os mesmos campos da mesma entidade. */
  'concurrent_edit',
  /** O payload não passou na validação do servidor. Não é resolvível pelo usuário. */
  'validation',
  /** O usuário não tem permissão para a operação. Não é resolvível pelo usuário. */
  'unauthorized',
  /**
   * O plano do usuário não permite mais uma história/entidade/bytes de armazenamento.
   * Não é resolvível editando a operação - é só informativo, não abre a tela de conflito.
   */
  'limit_exceeded',
  /** Qualquer outra falha ao aplicar a operação. */
  'unknown',
]);
export type SyncConflictReason = z.infer<typeof SyncConflictReasonSchema>;

export const SyncConflictSchema = z.object({
  /** Ecoa o `clientOperationId` da operação recusada, para o cliente correlacionar. */
  clientOperationId: z.string().optional(),
  entity: z.string(),
  entityId: z.string(),
  type: StoryUpdateTypeSchema,
  reason: SyncConflictReasonSchema,
  /** Mensagem técnica para log. A tela de conflito usa `reason`, não isto. */
  message: z.string(),
  /** Versão base que o cliente enviou. */
  clientVersion: z.number().int().optional(),
  /** Versão atual da entidade no servidor. */
  serverVersion: z.number().int().optional(),
  /** Estado atual da entidade no servidor, para a tela poder mostrar o comparativo. */
  serverEntity: z.record(z.string(), z.any()).nullable().optional(),
  /** O que o cliente tentou gravar, para a tela poder mostrar o comparativo. */
  attemptedChanges: z.record(z.string(), z.any()).optional(),
});
export type SyncConflict = z.infer<typeof SyncConflictSchema>;

export const SyncAppliedOperationSchema = z.object({
  clientOperationId: z.string().optional(),
  /**
   * Id da operação no log do servidor. Ausente quando a operação já estava aplicada e
   * portanto já tinha sido registrada num push anterior (reenvio idempotente).
   */
  operationId: z.string().optional(),
  /** Posição da operação na sequência do servidor. */
  operationVersion: z.number().int(),
  /** Versão da entidade depois da operação, para o cliente rebasear as próximas edições. */
  entityVersion: z.number().int().optional(),
  entity: z.string(),
  entityId: z.string(),
});
export type SyncAppliedOperation = z.infer<typeof SyncAppliedOperationSchema>;

export const SyncPushResultSchema = z.object({
  message: z.string(),
  processedUpdates: z.number().int(),
  serverMaxOperationVersion: z.number().int(),
  applied: z.array(SyncAppliedOperationSchema),
  conflicts: z.array(SyncConflictSchema),
});
export type SyncPushResult = z.infer<typeof SyncPushResultSchema>;
