import { CommentEntityType } from '../metadata/CommentEntityType';

/**
 * Comentário anexado a um campo específico (nativo ou atributo customizado) de uma entidade.
 * Exatamente um de `fieldId`/`fieldKey` é preenchido - `fieldId` referencia
 * `StorySchemaField.id` para campos customizados, `fieldKey` é o nome da propriedade nativa
 * (ex: "biography") para os demais. `contentSnapshot` congela o valor do campo no momento do
 * comentário, para que o comentário continue fazendo sentido mesmo depois que o campo for
 * editado; `excerptText` é o trecho relevante dentro desse snapshot, digitado/colado pelo
 * autor (não uma seleção de texto real - ver `docs/project_plan.md`/plano de implementação).
 */
export interface Comment {
  id: string;
  storyId: string;
  entityType: CommentEntityType;
  entityId: string;
  fieldId: string | null;
  fieldKey: string | null;
  contentSnapshot: string | null;
  excerptText: string | null;
  authorUserId: string;
  commentText: string;
  /** 1 = informacional, 2 = relevante, 3 = atenção, 4 = grave, 5 = imediato. */
  criticality: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
