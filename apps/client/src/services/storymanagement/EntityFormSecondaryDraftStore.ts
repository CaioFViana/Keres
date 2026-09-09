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

/** Serializes read-modify-write per draft key so concurrent patches cannot clobber each other. */
const draftLocks = new Map<string, Promise<unknown>>();

function withDraftLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = draftLocks.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  draftLocks.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

/** Test helper: drop queued draft locks so a hung suite cannot poison later cases. */
export function resetEntityFormSecondaryDraftLocksForTests(): void {
  draftLocks.clear();
}

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
  const key = storageKey(storyId, entityType, entityId);
  await withDraftLock(key, async () => {
    try {
      const payload: EntityFormSecondaryDraft = {
        ...draft,
        pendingEntityRelations: draft.pendingEntityRelations ?? [],
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to write entity secondary draft:', error);
      throw error;
    }
  });
}

export async function clearEntityFormSecondaryDraft(
  storyId: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  const key = storageKey(storyId, entityType, entityId);
  await withDraftLock(key, async () => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear entity secondary draft:', error);
      throw error;
    }
  });
}

/**
 * Patches an existing durable draft in place. No-ops when nothing is stored yet so
 * mid-session queue edits do not invent a draft before the save coordinator does.
 * Serialized with write/clear for the same key.
 */
export async function patchEntityFormSecondaryDraft(
  storyId: string,
  entityType: string,
  entityId: string,
  patch: Partial<Omit<EntityFormSecondaryDraft, 'updatedAt'>>,
): Promise<void> {
  const key = storageKey(storyId, entityType, entityId);
  await withDraftLock(key, async () => {
    const current = await readEntityFormSecondaryDraft(storyId, entityType, entityId);
    if (!current) return;
    try {
      const payload: EntityFormSecondaryDraft = {
        selectedTagIds: patch.selectedTagIds ?? current.selectedTagIds,
        pendingNoteRelations: patch.pendingNoteRelations ?? current.pendingNoteRelations,
        customValues: patch.customValues ?? current.customValues,
        pendingEntityRelations: patch.pendingEntityRelations ?? current.pendingEntityRelations,
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to patch entity secondary draft:', error);
      throw error;
    }
  });
}
