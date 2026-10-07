import {
  encodeWav,
  renderVoiceSliced,
  SAMPLE_RATE,
  type SliceHooks,
  type VoiceOptions,
  type VoiceScore,
  type VoiceTimbre,
} from '@keres/shared';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export { PREVIEW_MAX_SECONDS } from '../utils/songPlayback';

/** How much hummed audio is kept on the device; the oldest goes first. */
export const SONG_AUDIO_CACHE_BYTES = 20 * 1024 * 1024;
/** Bump when the voice changes, or the renderings kept from the old one would be heard. */
const VOICE_VERSION = 1;
/** A hum of one key press: long enough to hear the pitch. */
const TONE_BEATS = 1;
const TONE_TEMPO = 120;
const WEB_KEPT = 6;

/**
 * Where renderings live. Each is a WAV named by a hash of what made it, so the same tune, tempo and
 * voice is never rendered twice, and a changed note makes a new file rather than a stale one.
 */
export interface SongAudioStore {
  /** The address of a rendering already made, or `null`. */
  find(key: string): Promise<string | null>;
  put(key: string, bytes: Uint8Array): Promise<string>;
  /** Drops the oldest renderings until what is kept fits. */
  prune(maxBytes: number): Promise<void>;
}

/** A 53-bit hash of a string, fast enough for the notes of a long song and with no dependency. */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** What decides the sound: the notes, the tempo they are timed by, the voice and the click. */
export function songAudioKey(score: VoiceScore, options: VoiceOptions): string {
  const notes = score.notes.map((n) => `${n.pitch}:${n.start}:${n.duration}`).join(',');
  const click = options.clickBeatsPerBar ?? 0;
  return hashText(
    `${VOICE_VERSION}|${options.timbre}|${click}|${score.tempo}|${score.beats}|${notes}`,
  );
}

function nativeStore(): SongAudioStore {
  const directory = () => new Directory(Paths.cache, 'song-audio');
  return {
    async find(key) {
      const file = new File(directory(), `${key}.wav`);
      return file.exists ? file.uri : null;
    },
    async put(key, bytes) {
      const folder = directory();
      folder.create({ intermediates: true, idempotent: true });
      const file = new File(folder, `${key}.wav`);
      file.create({ overwrite: true });
      file.write(bytes);
      return file.uri;
    },
    async prune(maxBytes) {
      const folder = directory();
      if (!folder.exists) return;
      const entries = folder.list().flatMap((entry) => {
        if (!(entry instanceof File)) return [];
        let modified = 0;
        try {
          modified = entry.info().modificationTime ?? 0;
        } catch {
          // Without a time the file counts as the oldest, and goes first.
        }
        return [{ file: entry, size: entry.size ?? 0, modified }];
      });
      let total = entries.reduce((sum, entry) => sum + entry.size, 0);
      for (const entry of entries.sort((a, b) => a.modified - b.modified)) {
        if (total <= maxBytes) break;
        try {
          entry.file.delete();
          total -= entry.size;
        } catch (error) {
          console.log('SongAudioService: could not drop a rendering.', error);
        }
      }
    },
  };
}

/** A browser or the desktop shell has no cache folder to write to: renderings are blobs in memory. */
function memoryStore(): SongAudioStore {
  const urls = new Map<string, string>();
  return {
    async find(key) {
      return urls.get(key) ?? null;
    },
    async put(key, bytes) {
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/wav' }));
      urls.set(key, url);
      while (urls.size > WEB_KEPT) {
        const oldest = urls.keys().next().value as string;
        URL.revokeObjectURL(urls.get(oldest) as string);
        urls.delete(oldest);
      }
      return url;
    },
    async prune() {},
  };
}

export const defaultSongAudioStore = (): SongAudioStore =>
  Platform.OS === 'web' ? memoryStore() : nativeStore();

export interface RenderedSong {
  uri: string;
  seconds: number;
  /** It was already made: no rendering was done. */
  cached: boolean;
}

export interface RenderHooks {
  onProgress?: (fraction: number) => void;
  isCancelled?: () => boolean;
}

export interface SongAudioDeps {
  store?: SongAudioStore;
  yieldToUi?: () => Promise<void>;
  maxBytes?: number;
  now?: () => number;
}

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Turns a tune into a file the player can open: rendered in slices that give the thread back, kept
 * by the hash of what made it, and pruned to a size. A cancelled render leaves nothing behind.
 */
export function createSongAudioService(deps: SongAudioDeps = {}) {
  const store = deps.store ?? defaultSongAudioStore();
  const yieldToUi = deps.yieldToUi ?? nextTick;
  const maxBytes = deps.maxBytes ?? SONG_AUDIO_CACHE_BYTES;

  return {
    async render(
      score: VoiceScore,
      options: VoiceOptions,
      hooks: RenderHooks = {},
    ): Promise<RenderedSong | null> {
      const key = songAudioKey(score, options);
      const seconds = (score.beats * 60) / score.tempo;
      const kept = await store.find(key);
      if (kept) return { uri: kept, seconds, cached: true };

      const sliceHooks: SliceHooks = {
        yieldToUi,
        now: deps.now,
        onProgress: hooks.onProgress,
        isCancelled: hooks.isCancelled,
      };
      const samples = await renderVoiceSliced(score, options, sliceHooks);
      if (!samples) return null;
      const uri = await store.put(key, encodeWav(samples, options.sampleRate ?? SAMPLE_RATE));
      // Pruning is housekeeping: a failure to do it must not fail the song that was just made.
      store.prune(maxBytes).catch((error) => {
        console.log('SongAudioService: could not prune the renderings.', error);
      });
      return { uri, seconds, cached: false };
    },

    /** The short hum a key of the keyboard plays. */
    async tone(pitch: number, timbre: VoiceTimbre): Promise<string> {
      const score: VoiceScore = {
        notes: [{ pitch, start: 0, duration: TONE_BEATS, sung: true }],
        beats: TONE_BEATS,
        tempo: TONE_TEMPO,
      };
      const rendered = await this.render(score, { timbre });
      if (!rendered) throw new Error('tone render was cancelled');
      return rendered.uri;
    },
  };
}

export type SongAudioService = ReturnType<typeof createSongAudioService>;
