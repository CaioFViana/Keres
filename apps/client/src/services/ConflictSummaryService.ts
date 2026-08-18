import type { TFunction } from 'i18next';
import type { EntityRef } from './EntityNameBatchResolver';
import type { PendingConflict } from './SyncConflictService';

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

/**
 * Junta os dois lados de um conflito de relação num único objeto para montar a frase: prefere
 * o valor local (o que o usuário fez), cai para o do servidor só nos campos que a operação
 * local não tocou (ex: uma exclusão pura não carrega `relationType`, mas o servidor sabe qual era).
 */
function mergedValuesOf(conflict: PendingConflict): Record<string, any> {
  return { ...(conflict.serverValues ?? {}), ...conflict.localValues };
}

/** Todas as referências de entidade que os conflitos de relação de um lote vão precisar
 *  resolver - para passar de uma vez a `EntityNameBatchResolver.resolveMany`. */
export function collectEntityRefs(conflicts: PendingConflict[]): EntityRef[] {
  const refs: EntityRef[] = [];
  for (const conflict of conflicts) {
    const targets = RELATION_FIELD_TARGETS[conflict.entityType];
    if (!targets) continue;
    const merged = mergedValuesOf(conflict);
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
  names: Map<string, string>,
  t: TFunction,
): { title: string; detail: string } {
  const merged = mergedValuesOf(conflict);
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
  names: Map<string, string>,
  t: TFunction,
): ConflictSummary[] {
  return conflicts.map((conflict) => {
    const entityLabel = t(ENTITY_LABEL_KEYS[conflict.entityType] || conflict.entityType, {
      defaultValue: conflict.entityType,
    });

    if (RELATION_ENTITY_TYPES.has(conflict.entityType)) {
      const { title, detail } = buildRelationSummary(conflict, names, t);
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
    const entityName = formatValue(
      conflict.localValues.name ??
        conflict.localValues.title ??
        conflict.serverValues?.name ??
        conflict.serverValues?.title,
      conflict.entityId,
    );

    const diffFields: ConflictDiffField[] = canQuickResolve
      ? []
      : conflict.contestedFields.map((field) => ({
          field,
          label: t(field, { defaultValue: field }),
          localDisplay: formatValue(conflict.localValues[field], emptyLabel),
          serverDisplay: formatValue(conflict.serverValues?.[field], emptyLabel),
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
