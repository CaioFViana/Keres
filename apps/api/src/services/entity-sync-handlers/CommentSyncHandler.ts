import {
  CreateCommentDataSchema,
  CreateCommentDataType,
  CreateStoryUpdate,
  PartialCommentSchema,
  UpdateStoryUpdate,
} from '@keres/shared';
import { db } from '../../db';
import { comments } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class CommentSyncHandler extends BaseSyncEntityHandler<
  typeof CreateCommentDataSchema,
  typeof PartialCommentSchema
> {
  entityName = 'Comment';

  constructor() {
    super('comments', 'id', 'version', CreateCommentDataSchema, PartialCommentSchema, {
      storyIdColumnName: 'storyId',
      userIdColumnName: 'authorUserId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const data: CreateCommentDataType = this.createSchema.parse(update.data);
    if (data.authorUserId !== userId) {
      throw new SyncConflictError(
        'unauthorized',
        'A user can only create comments under their own identity.',
      );
    }
    // O portão reader/allowReaderComments já foi aplicado em SyncService.processAndRecordUpdates
    // antes deste método ser chamado - nada extra a checar aqui quanto a isso.
    const now = this.parseOperationTime(update.operationTime);
    await db.insert(comments).values({
      id: update.id!,
      storyId,
      entityType: data.entityType,
      entityId: data.entityId,
      fieldId: data.fieldId,
      fieldKey: data.fieldKey,
      contentSnapshot: data.contentSnapshot,
      excerptText: data.excerptText,
      authorUserId: userId,
      commentText: data.commentText,
      criticality: data.criticality,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    // Editar o texto/trecho/criticidade é sempre restrito ao autor, mesmo para o dono da
    // história - o dono só tem um privilégio elevado de *exclusão* (ver SyncService.ts),
    // não de edição do conteúdo escrito por outra pessoa.
    if (currentEntity.authorUserId !== userId) {
      throw new SyncConflictError('unauthorized', 'Only the comment author can edit it.');
    }
    const changes = { ...update.changes };
    delete changes.storyId;
    delete changes.entityType;
    delete changes.entityId;
    delete changes.fieldId;
    delete changes.fieldKey;
    delete changes.authorUserId;
    delete changes.contentSnapshot;
    await super.update(userId, storyId, { ...update, changes }, currentEntity);
  }

  // delete() não é sobrescrito: a autorização (dono da história pode excluir qualquer
  // comentário; escritor/leitor só o próprio) já é resolvida em
  // SyncService.processAndRecordUpdates, o único lugar onde o `role` do usuário já está
  // disponível sem precisar estender a interface SyncEntityHandler só para este caso.
}
