import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NoteRelation } from '@keres/shared/entities/Note';

/**
 * Durable secondary-data draft for multi-step entity forms.
 *
 * After the base row exists but before tags/notes/attributes/entity-relations finish writing, a
 * process kill would otherwise drop in-memory queues. The base entity remains in SQLite; this store
 * keeps the author's unfinished secondary intent so reopening the entity can restore it.
 */
export type EntityFormSecondaryDraft = {
  selectedTagIds: string[];
  pendingNoteRelations: NoteRelation[];
  /** fieldId → encoded value; kept free of UI module imports for layering. */
  customValues: Record<string, string | null>;
  /**
   * Entity-specific pending queues (Character↔Character, Location↔Location, …).
   * Typed as unknown[] here so the store stays free of every relation entity module.
   */
  pendingEntityRelations: unknown[];
  updatedAt: string;
};

const storageKey = (storyId: string, entityType: string, entityId: string) =>
  `keres:entity-secondary-draft:${storyId}:${entityType}:${entityId}`;

export async function readEntityFormSecondaryDraft(
  storyId: string,
  entityType: string,
  entityId: string,
): Promise<EntityFormSecondaryDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(storyId, entityType, entityId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EntityFormSecondaryDraft>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      selectedTagIds: Array.isArray(parsed.selectedTagIds) ? parsed.selectedTagIds : [],
      pendingNoteRelations: Array.isArray(parsed.pendingNoteRelations)
        ? parsed.pendingNoteRelations
        : [],
      customValues:
        parsed.customValues && typeof parsed.customValues === 'object' ? parsed.customValues : {},
      pendingEntityRelations: Array.isArray(parsed.pendingEntityRelations)
        ? parsed.pendingEntityRelations
        : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to read entity secondary draft:', error);
    return null;
  }
}

export async function writeEntityFormSecondaryDraft(
  storyId: string,
  entityType: string,
  entityId: string,
  draft: Omit<EntityFormSecondaryDraft, 'updatedAt'>,
): Promise<void> {
  try {
    const payload: EntityFormSecondaryDraft = {
      ...draft,
      pendingEntityRelations: draft.pendingEntityRelations ?? [],
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(storageKey(storyId, entityType, entityId), JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to write entity secondary draft:', error);
    throw error;
  }
}

export async function clearEntityFormSecondaryDraft(
  storyId: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(storyId, entityType, entityId));
  } catch (error) {
    console.error('Failed to clear entity secondary draft:', error);
    throw error;
  }
}

/**
 * Patches an existing durable draft in place. No-ops when nothing is stored yet so
 * mid-session queue edits do not invent a draft before the save coordinator does.
 */
export async function patchEntityFormSecondaryDraft(
  storyId: string,
  entityType: string,
  entityId: string,
  patch: Partial<Omit<EntityFormSecondaryDraft, 'updatedAt'>>,
): Promise<void> {
  const current = await readEntityFormSecondaryDraft(storyId, entityType, entityId);
  if (!current) return;
  await writeEntityFormSecondaryDraft(storyId, entityType, entityId, {
    selectedTagIds: patch.selectedTagIds ?? current.selectedTagIds,
    pendingNoteRelations: patch.pendingNoteRelations ?? current.pendingNoteRelations,
    customValues: patch.customValues ?? current.customValues,
    pendingEntityRelations: patch.pendingEntityRelations ?? current.pendingEntityRelations,
  });
}
