import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import type { TFunction } from 'i18next';
import type { EntityRef } from './EntityNameBatchResolver';
import type { PendingConflict } from './SyncConflictService';

/** "extraNotes" -> "Extra Notes" - fallback for a field `entityFieldMetadata` doesn't cover.
 *  Same helper as `OperationLogDetailScreen.tsx`'s, duplicated rather than imported since that
 *  file is a screen, not a service this module should depend on. */
function humanizeFieldName(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

/**
 * Rótulo de um campo de conteúdo disputado. `t(field, {defaultValue: field})` (o que a modal
 * antiga fazia) só funciona por coincidência para os poucos campos que também têm uma chave de
 * tradução solta sem o prefixo `field_` (ex. `motivation`) - `isFavorite` não tem, e aparecia
 * cru na tela. `entityFieldMetadata` é a fonte de verdade real do rótulo de cada campo.
 */
function fieldLabel(entityType: string, field: string, t: TFunction): string {
  const meta = entityFieldMetadata[entityType]?.find((f) => f.name === field);
  return meta ? t(meta.label) : humanizeFieldName(field);
}

/**
 * Campos de conteúdo (não os das 8 relações acima) que são IDs de outra entidade - mesmo
 * mapeamento que `OperationLogDetailScreen.tsx`'s `REFERENCE_FIELD_ENTITY_TYPES` usa pra
 * resolver `EntityService.getEntityIdentifier`. Sem isto, um conflito genuíno em `Scene.chapterId`
 * ou `Choice.nextSceneId` mostrava o ID cru no comparativo campo a campo em vez do nome.
 */
const CONTENT_REFERENCE_FIELDS: Record<string, string> = {
  characterId: 'Character',
  character1Id: 'Character',
  character2Id: 'Character',
  characterOwnerId: 'Character',
  newCharacterOwnerId: 'Character',
  sceneId: 'Scene',
  nextSceneId: 'Scene',
  itemId: 'Item',
  locationId: 'Location',
  chapterId: 'Chapter',
  tagId: 'Tag',
  noteId: 'Note',
  worldRuleId: 'WorldRule',
  galleryId: 'Gallery',
  choiceId: 'Choice',
};

/**
 * Nome da entidade no protocolo de sincronização para a chave de tradução já existente.
 * Movido de `SyncConflictModal.tsx` - tanto a lista de conflitos quanto o drill-in de diff
 * precisam do mesmo rótulo.
 */
export const ENTITY_LABEL_KEYS: Record<string, string> = {
  Chapter: 'chapter',
  Character: 'character',
  CharacterRelation: 'character_relation',
  CharacterScene: 'character_scene_relation',
  Choice: 'choice',
  Item: 'item',
  ItemJourney: 'item_journey',
  Location: 'location',
  Note: 'note',
  NoteRelation: 'note_relation',
  Scene: 'scene',
  Story: 'story',
  Tag: 'tag',
  TagRelation: 'tag_relation',
  WorldRule: 'world_rule',
};

type RelationFieldTarget =
  /** Aponta sempre para o mesmo tipo de entidade (ex: `CharacterScene.characterId` é sempre um Character). */
  | { kind: 'fixed'; field: string; entityType: string }
  /** Par polimórfico: o tipo do alvo vem do valor de outro campo em tempo de execução
   *  (ex: `GalleryRelation.ownerId` + `ownerType`). */
  | { kind: 'dynamic'; idField: string; typeField: string };

/**
 * Quais campos de cada relação são IDs, e para que tipo de entidade cada um aponta - usado
 * tanto para montar o lote de referências a resolver (`collectEntityRefs`) quanto para montar
 * a frase legível de cada conflito (`buildRelationSummary`). Nomes de campo aqui são os do
 * payload de sincronização (localValues/serverValues de um `PendingConflict`), não
 * necessariamente os da tabela local - `CharacterRelation` é a única que difere
 * (`character1Id`/`character2Id`, não `charId1`/`charId2` - ver `entityTableRegistry.ts`).
 */
const RELATION_FIELD_TARGETS: Record<string, RelationFieldTarget[]> = {
  CharacterRelation: [
    { kind: 'fixed', field: 'character1Id', entityType: 'Character' },
    { kind: 'fixed', field: 'character2Id', entityType: 'Character' },
  ],
  TagRelation: [
    { kind: 'fixed', field: 'tagId', entityType: 'Tag' },
    { kind: 'dynamic', idField: 'relationId', typeField: 'relationType' },
  ],
  NoteRelation: [
    { kind: 'fixed', field: 'noteId', entityType: 'Note' },
    { kind: 'dynamic', idField: 'relationId', typeField: 'relationType' },
  ],
  LocationRelation: [
    { kind: 'fixed', field: 'locationAId', entityType: 'Location' },
    { kind: 'fixed', field: 'locationBId', entityType: 'Location' },
  ],
  GalleryRelation: [
    { kind: 'fixed', field: 'galleryId', entityType: 'Gallery' },
    { kind: 'dynamic', idField: 'ownerId', typeField: 'ownerType' },
  ],
  CharacterScene: [
    { kind: 'fixed', field: 'characterId', entityType: 'Character' },
    { kind: 'fixed', field: 'sceneId', entityType: 'Scene' },
  ],
  ItemJourney: [
    { kind: 'fixed', field: 'itemId', entityType: 'Item' },
    { kind: 'fixed', field: 'sceneId', entityType: 'Scene' },
    { kind: 'fixed', field: 'newCharacterOwnerId', entityType: 'Character' },
  ],
  SeeAlsoRelation: [
    { kind: 'dynamic', idField: 'entityAId', typeField: 'entityAType' },
    { kind: 'dynamic', idField: 'entityBId', typeField: 'entityBType' },
  ],
};

/** Os 8 tipos de entidade que são relações/junções: sempre resolvidos em uma linha legível,
 *  nunca numa tabela de diff campo a campo (o problema original que motivou esta mudança). */
export const RELATION_ENTITY_TYPES = new Set(Object.keys(RELATION_FIELD_TARGETS));

export interface ConflictDiffField {
  field: string;
  label: string;
  localDisplay: string;
  serverDisplay: string;
}

export interface ConflictSummary {
  id: string;
  entityType: string;
  kind: 'relation' | 'content';
  /** Rótulo traduzido do tipo de entidade (ex: "Personagem"). */
  entityLabel: string;
  /** Título curto da linha - o tipo da relação, ou o rótulo da entidade para conflitos de conteúdo. */
  title: string;
  /** Frase legível descrevendo o conflito, com nomes já resolvidos - nunca um ID cru. */
  detail: string;
  reason: PendingConflict['reason'];
  /** Quando true, a linha pode ser resolvida com um botão (manter meu/manter servidor) sem
   *  abrir o drill-in de diff - ou porque é uma relação, ou porque não há campos genuinamente
   *  disputados para comparar. */
  canQuickResolve: boolean;
  /** Só populado para `kind === 'content'` com `canQuickResolve === false`. */
  diffFields: ConflictDiffField[];
}

/** Texto legível para qualquer valor vindo de um payload de sincronização. */
function formatValue(value: unknown, emptyLabel: string): string {
  if (value === null || value === undefined || value === '') {
    return emptyLabel;
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Chave de um snapshot no mapa devolvido por `EntitySnapshotResolver.resolveMany`. */
const snapshotKey = (entityType: string, entityId: string) => `${entityType}:${entityId}`;

/**
 * Uma referência por conflito - a própria entidade dele - para pedir de uma vez a
 * `EntitySnapshotResolver.resolveMany` antes de montar os resumos. Precisa rodar primeiro e
 * separado de `collectEntityRefs`: só depois de ter o snapshot é que dá pra saber, por
 * exemplo, quem são os dois personagens de uma `CharacterRelation` cujo conflito não carrega
 * `character1Id`/`character2Id` em nenhum dos lados (caso `deleted_on_server`).
 */
export function collectConflictEntityRefs(conflicts: PendingConflict[]): EntityRef[] {
  return conflicts.map((conflict) => ({
    entityType: conflict.entityType,
    entityId: conflict.entityId,
  }));
}

/**
 * Junta os três níveis de um conflito num único objeto para montar a frase: prefere o valor
 * local (o que o usuário fez), cai para o do servidor nos campos que a operação local não
 * tocou, e só por último cai pro snapshot da linha local atual - necessário porque um
 * conflito `deleted_on_server` carrega só `{isDeleted, version}` do lado do servidor, de
 * propósito (ver `reconcileRemoteUpdate`), então nem o nome de uma entidade de conteúdo nem
 * os IDs de uma relação estão em `localValues`/`serverValues` quando o campo em questão não é
 * o que o usuário editou offline - só o snapshot da linha local (que a exclusão remota nunca
 * chegou a apagar) ainda tem essa informação.
 */
function mergedValuesOf(
  conflict: PendingConflict,
  snapshots: Map<string, Record<string, any>>,
): Record<string, any> {
  const snapshot = snapshots.get(snapshotKey(conflict.entityType, conflict.entityId)) ?? {};
  return { ...snapshot, ...(conflict.serverValues ?? {}), ...conflict.localValues };
}

/** Todas as referências de entidade que os conflitos de relação, mais quaisquer campos de
 *  conteúdo que sejam IDs de outra entidade, vão precisar resolver - para passar de uma vez a
 *  `EntityNameBatchResolver.resolveMany`. Precisa dos snapshots já resolvidos (ver
 *  `collectConflictEntityRefs`) para enxergar campos de relação que só existem lá. */
export function collectEntityRefs(
  conflicts: PendingConflict[],
  snapshots: Map<string, Record<string, any>>,
): EntityRef[] {
  const refs: EntityRef[] = [];
  for (const conflict of conflicts) {
    const targets = RELATION_FIELD_TARGETS[conflict.entityType];
    if (targets) {
      const merged = mergedValuesOf(conflict, snapshots);
      for (const target of targets) {
        if (target.kind === 'fixed') {
          const entityId = merged[target.field];
          if (typeof entityId === 'string' && entityId) {
            refs.push({ entityType: target.entityType, entityId });
          }
        } else {
          const entityId = merged[target.idField];
          const entityType = merged[target.typeField];
          if (
            typeof entityId === 'string' &&
            entityId &&
            typeof entityType === 'string' &&
            entityType
          ) {
            refs.push({ entityType, entityId });
          }
        }
      }
      continue;
    }

    for (const field of conflict.contestedFields) {
      const entityType = CONTENT_REFERENCE_FIELDS[field];
      if (!entityType) continue;
      const entityId = conflict.localValues[field] ?? conflict.serverValues?.[field];
      if (typeof entityId === 'string' && entityId) {
        refs.push({ entityType, entityId });
      }
    }
  }
  return refs;
}

function nameOf(
  names: Map<string, string>,
  entityType: string | undefined,
  entityId: string | undefined,
  fallback: string,
): string {
  if (!entityType || !entityId) return fallback;
  return names.get(`${entityType}:${entityId}`) || fallback;
}

function buildRelationSummary(
  conflict: PendingConflict,
  snapshots: Map<string, Record<string, any>>,
  names: Map<string, string>,
  t: TFunction,
): { title: string; detail: string } {
  const merged = mergedValuesOf(conflict, snapshots);
  const unknown = t('unknown_entity');

  switch (conflict.entityType) {
    case 'CharacterRelation': {
      const a = nameOf(names, 'Character', merged.character1Id, unknown);
      const b = nameOf(names, 'Character', merged.character2Id, unknown);
      return {
        title: t('character_relation'),
        detail: merged.relationType ? `${a} - ${b} (${merged.relationType})` : `${a} - ${b}`,
      };
    }
    case 'TagRelation': {
      const tag = nameOf(names, 'Tag', merged.tagId, unknown);
      const target = nameOf(names, merged.relationType, merged.relationId, unknown);
      return { title: t('tag_relation'), detail: `${tag} - ${target}` };
    }
    case 'NoteRelation': {
      const note = nameOf(names, 'Note', merged.noteId, unknown);
      const target = nameOf(names, merged.relationType, merged.relationId, unknown);
      return { title: t('note_relation'), detail: `${note} - ${target}` };
    }
    case 'LocationRelation': {
      const a = nameOf(names, 'Location', merged.locationAId, unknown);
      const b = nameOf(names, 'Location', merged.locationBId, unknown);
      const detail =
        merged.relationType === 'contains'
          ? t('location_contains_location', { parentName: a, childName: b })
          : t('location_connected_to_location', { locationAName: a, locationBName: b });
      return { title: t('location_relation'), detail };
    }
    case 'GalleryRelation': {
      const gallery = nameOf(names, 'Gallery', merged.galleryId, unknown);
      const owner = nameOf(names, merged.ownerType, merged.ownerId, unknown);
      return { title: t('gallery_relation'), detail: `${gallery} - ${owner}` };
    }
    case 'CharacterScene': {
      const character = nameOf(names, 'Character', merged.characterId, unknown);
      const scene = nameOf(names, 'Scene', merged.sceneId, unknown);
      return { title: t('character_scene_relation'), detail: `${character} - ${scene}` };
    }
    case 'ItemJourney': {
      const item = nameOf(names, 'Item', merged.itemId, unknown);
      const scene = nameOf(names, 'Scene', merged.sceneId, unknown);
      return { title: t('item_journey'), detail: `${item} ${t('showed_in_scene')} ${scene}` };
    }
    case 'SeeAlsoRelation': {
      const a = nameOf(names, merged.entityAType, merged.entityAId, unknown);
      const b = nameOf(names, merged.entityBType, merged.entityBId, unknown);
      return { title: t('see_also_relation'), detail: `${a} - ${b}` };
    }
    default:
      return {
        title: t(ENTITY_LABEL_KEYS[conflict.entityType] || conflict.entityType),
        detail: conflict.entityId,
      };
  }
}

/**
 * Mesmo predicado que `SyncConflictModal.tsx` usava para decidir entre o seletor de campos e
 * o texto de fallback binário - reaproveitado aqui para decidir `canQuickResolve`.
 */
function isBinaryContentConflict(conflict: PendingConflict): boolean {
  return (
    conflict.isDeletedOnServer ||
    conflict.isLocalDelete ||
    conflict.serverValues === null ||
    conflict.contestedFields.length === 0
  );
}

export function buildConflictSummaries(
  conflicts: PendingConflict[],
  snapshots: Map<string, Record<string, any>>,
  names: Map<string, string>,
  t: TFunction,
): ConflictSummary[] {
  return conflicts.map((conflict) => {
    const entityLabel = t(ENTITY_LABEL_KEYS[conflict.entityType] || conflict.entityType, {
      defaultValue: conflict.entityType,
    });

    if (RELATION_ENTITY_TYPES.has(conflict.entityType)) {
      const { title, detail } = buildRelationSummary(conflict, snapshots, names, t);
      return {
        id: conflict.id,
        entityType: conflict.entityType,
        kind: 'relation',
        entityLabel,
        title,
        detail,
        reason: conflict.reason,
        canQuickResolve: true,
        diffFields: [],
      };
    }

    const canQuickResolve = isBinaryContentConflict(conflict);
    const emptyLabel = t('conflict_empty_value');
    // `name`/`title` cobre a maioria das entidades, mas não todas: Choice não tem nenhum dos
    // dois (o campo que identifica é `text`), e Gallery tem `title` opcional, caindo pro nome
    // do arquivo (mesma regra que `EntityNameBatchResolver.ts` já usa). E nenhum dos dois pode
    // vir só de `localValues`/`serverValues`: um conflito `deleted_on_server` não carrega o
    // nome em nenhum dos dois lados (ver `mergedValuesOf`) - por isso o snapshot da linha
    // local entra como terceiro nível, antes de cair pro ID cru.
    const mergedContent = mergedValuesOf(conflict, snapshots);
    const entityName = formatValue(
      mergedContent.name ?? mergedContent.title ?? mergedContent.text ?? mergedContent.fileName,
      conflict.entityId,
    );

    const displayValue = (field: string, value: unknown): string => {
      const targetType = CONTENT_REFERENCE_FIELDS[field];
      if (targetType && typeof value === 'string' && value) {
        return names.get(`${targetType}:${value}`) || formatValue(value, emptyLabel);
      }
      return formatValue(value, emptyLabel);
    };

    const diffFields: ConflictDiffField[] = canQuickResolve
      ? []
      : conflict.contestedFields.map((field) => ({
          field,
          label: fieldLabel(conflict.entityType, field, t),
          localDisplay: displayValue(field, conflict.localValues[field]),
          serverDisplay: displayValue(field, conflict.serverValues?.[field]),
        }));

    // No caso binário (nada a comparar campo a campo) o motivo explica melhor a decisão do
    // que só o nome da entidade - mesma frase que `SyncConflictModal.tsx` já montava.
    const detail = canQuickResolve
      ? t(`conflict_reason_${conflict.reason}`, {
          defaultValue: t('conflict_reason_unknown'),
          entity: entityLabel,
        })
      : entityName;

    return {
      id: conflict.id,
      entityType: conflict.entityType,
      kind: 'content',
      entityLabel,
      title: entityName,
      detail,
      reason: conflict.reason,
      canQuickResolve,
      diffFields,
    };
  });
}
