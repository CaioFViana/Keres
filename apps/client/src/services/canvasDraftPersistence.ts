import AsyncStorage from '@react-native-async-storage/async-storage';

export type CanvasDraftKind = 'board' | 'location-map';

const KEY_PREFIX = 'keres:canvas-draft:';

const storageKey = (kind: CanvasDraftKind, storyId: string, canvasId: string) =>
  `${KEY_PREFIX}${kind}:${storyId}:${canvasId}`;

/** In-flight durable writes, keyed so rapid canvas edits coalesce. */
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();
const WRITE_DEBOUNCE_MS = 400;

export async function readCanvasDraft<T extends object>(
  kind: CanvasDraftKind,
  storyId: string,
  canvasId: string,
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(kind, storyId, canvasId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.error(`Failed to read ${kind} canvas draft:`, error);
    return null;
  }
}

export function scheduleWriteCanvasDraft(
  kind: CanvasDraftKind,
  storyId: string,
  canvasId: string,
  draft: object,
): void {
  const key = storageKey(kind, storyId, canvasId);
  const existing = pendingWrites.get(key);
  if (existing) clearTimeout(existing);
  pendingWrites.set(
    key,
    setTimeout(() => {
      pendingWrites.delete(key);
      void AsyncStorage.setItem(key, JSON.stringify(draft)).catch((error) => {
        console.error(`Failed to write ${kind} canvas draft:`, error);
      });
    }, WRITE_DEBOUNCE_MS),
  );
}

export async function writeCanvasDraftNow(
  kind: CanvasDraftKind,
  storyId: string,
  canvasId: string,
  draft: object,
): Promise<void> {
  const key = storageKey(kind, storyId, canvasId);
  const existing = pendingWrites.get(key);
  if (existing) {
    clearTimeout(existing);
    pendingWrites.delete(key);
  }
  try {
    await AsyncStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    console.error(`Failed to write ${kind} canvas draft:`, error);
  }
}

export async function clearCanvasDraft(
  kind: CanvasDraftKind,
  storyId: string,
  canvasId: string,
): Promise<void> {
  const key = storageKey(kind, storyId, canvasId);
  const existing = pendingWrites.get(key);
  if (existing) {
    clearTimeout(existing);
    pendingWrites.delete(key);
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to clear ${kind} canvas draft:`, error);
  }
}

/** Drops every durable canvas draft (board + location map). Used on client store reset. */
export async function clearAllCanvasDrafts(): Promise<void> {
  for (const timer of pendingWrites.values()) clearTimeout(timer);
  pendingWrites.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const draftKeys = keys.filter((key) => key.startsWith(KEY_PREFIX));
    if (draftKeys.length > 0) {
      await AsyncStorage.multiRemove(draftKeys);
    }
  } catch (error) {
    console.error('Failed to clear all canvas drafts:', error);
  }
}
