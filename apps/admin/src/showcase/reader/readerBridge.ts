/**
 * What the showcase page keeps for the reader it embeds.
 *
 * The reader runs sandboxed, without a storage of its own, so it asks this page for its saves and
 * hands the whole list back when it changes (see `readerApp.ts` in the shared package). The page
 * is the only writer of `localStorage`, and it writes only what it has read back into a shape it
 * knows: a reader page is somebody's story, so whatever it sends is data to be checked, never to be
 * stored as it came.
 */

export const READER_MAX_SAVES = 40;
export const READER_MAX_STEPS = 5000;
const MAX_ID = 64;

export type ReaderStep = { s: string; c: string | null };

export type ReaderSave =
  | {
      id: string;
      kind: 'auto' | 'manual';
      name: string;
      at: string;
      scene: string;
      count: number;
      steps: ReaderStep[];
      place?: number;
    }
  | { id: 'prefs'; kind: 'prefs'; theme: '' | 'light' | 'dark' | 'sepia'; size: number };

export function readerStorageKey(storyId: string, publicationId: string): string {
  return `keres_reader_${storyId}_${publicationId}`;
}

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length <= max ? value : null;

function sanitizeSave(value: unknown): ReaderSave | null {
  if (!value || typeof value !== 'object') return null;
  const save = value as Record<string, unknown>;
  if (save.kind === 'prefs') {
    const theme =
      save.theme === 'light' || save.theme === 'dark' || save.theme === 'sepia' ? save.theme : '';
    const size = Number(save.size);
    return { id: 'prefs', kind: 'prefs', theme, size: size >= 70 && size <= 200 ? size : 100 };
  }
  if (save.kind !== 'auto' && save.kind !== 'manual') return null;
  const id = text(save.id, MAX_ID);
  const name = text(save.name, 120);
  const at = text(save.at, 40);
  if (!id || name === null || at === null) return null;
  const base = { id, kind: save.kind, name, at, scene: text(save.scene, 160) ?? '' } as const;
  const place = Number(save.place);
  if (Array.isArray(save.steps)) {
    if (save.steps.length === 0 || save.steps.length > READER_MAX_STEPS) return null;
    const steps: ReaderStep[] = [];
    for (const step of save.steps) {
      const entry = step && typeof step === 'object' ? (step as Record<string, unknown>) : null;
      const scene = text(entry?.s, MAX_ID);
      const choice = entry?.c === null ? null : text(entry?.c, MAX_ID);
      if (!scene || (choice === null && entry?.c !== null)) return null;
      steps.push({ s: scene, c: choice });
    }
    return { ...base, count: steps.length, steps };
  }
  // A linear story remembers a place, not a path.
  if (place >= 0 && place <= 1) return { ...base, count: 0, steps: [], place };
  return null;
}

/**
 * The list the reader sent, kept only in the parts this page knows, or null when it is not a list
 * at all. Entries it cannot read are dropped rather than refusing the rest.
 */
export function sanitizeReaderSaves(value: unknown): ReaderSave[] | null {
  if (!Array.isArray(value)) return null;
  const kept: ReaderSave[] = [];
  for (const entry of value.slice(0, READER_MAX_SAVES + 2)) {
    const save = sanitizeSave(entry);
    if (save) kept.push(save);
  }
  return kept;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** What was kept for this story version, re-read through the same check (storage is not trusted either). */
export function loadReaderSaves(storage: StorageLike, key: string): ReaderSave[] {
  try {
    const raw = storage.getItem(key);
    return raw ? (sanitizeReaderSaves(JSON.parse(raw)) ?? []) : [];
  } catch {
    return [];
  }
}

export function storeReaderSaves(storage: StorageLike, key: string, saves: ReaderSave[]): void {
  try {
    storage.setItem(key, JSON.stringify(saves));
  } catch {
    // Storage is full or blocked: the reading goes on, only its keeping does not.
  }
}

/** The site's colors the reader wears while its own theme is "auto". Read from the page's CSS variables. */
export type ReaderPalette = Record<'bg' | 'fg' | 'muted' | 'accent' | 'line' | 'card', string>;

const PALETTE_SOURCES: Record<keyof ReaderPalette, string> = {
  bg: '--color-bg',
  fg: '--color-text',
  muted: '--color-text-secondary',
  accent: '--color-primary',
  line: '--color-border',
  card: '--color-surface',
};

export function readerPaletteOf(element: Element = document.documentElement): ReaderPalette {
  const style = getComputedStyle(element);
  const palette = {} as ReaderPalette;
  for (const key of Object.keys(PALETTE_SOURCES) as (keyof ReaderPalette)[]) {
    palette[key] = style.getPropertyValue(PALETTE_SOURCES[key]).trim();
  }
  return palette;
}

export type ReaderMessage = { type: 'load' } | { type: 'write'; saves: unknown };

/** A message of the reader protocol, or null for anything else that happens to arrive. */
export function readReaderMessage(data: unknown): ReaderMessage | null {
  if (!data || typeof data !== 'object') return null;
  const message = data as { keresReader?: unknown; type?: unknown; saves?: unknown };
  if (message.keresReader !== 1) return null;
  if (message.type === 'load') return { type: 'load' };
  if (message.type === 'write') return { type: 'write', saves: message.saves };
  return null;
}
