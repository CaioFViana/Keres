import { useCallback, useEffect, useRef, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { SongSelect } from '@/src/db/schema';
import { createSongService, type SongFields } from '@/src/services/storymanagement/SongService';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';

/** How long a song waits, after the last keystroke, before it is written. */
export const SONG_SAVE_DELAY_MS = 1500;

/**
 * What is being written of a song, kept apart from what is saved of it.
 *
 * Typing changes only the draft, so no write - no sync operation - happens per keystroke: the fields
 * touched are saved together once the person pauses, when they leave a field, and when the screen
 * closes. The value shown is the draft's where there is one and the saved song's otherwise, so
 * another device's change to a field nobody is typing in still comes through.
 */
export function useSongDraft(song: SongSelect | null | undefined, delayMs = SONG_SAVE_DELAY_MS) {
  const db = useDrizzle();
  const userId = useUserSettingsStore((state) => state.userId);
  const [pending, setPending] = useState<Partial<SongFields>>({});
  const pendingRef = useRef<Partial<SongFields>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const songId = song?.id;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const changes = pendingRef.current;
    if (!songId || !userId || Object.keys(changes).length === 0) return;
    setSaving(true);
    try {
      await createSongService(db).updateSong(userId, songId, changes);
      setError(null);
      // What was written is no longer a draft - unless the person kept typing meanwhile.
      const stillPending: Partial<SongFields> = {};
      for (const key of Object.keys(pendingRef.current) as (keyof SongFields)[]) {
        if (pendingRef.current[key] !== changes[key]) {
          (stillPending as Record<string, unknown>)[key] = pendingRef.current[key];
        }
      }
      pendingRef.current = stillPending;
      setPending(stillPending);
    } catch (saveError) {
      console.log('useSongDraft: could not save the song.', saveError);
      // The draft stays: the person can fix it, and the next change tries again.
      setError(saveError instanceof Error ? saveError.message : 'save failed');
    } finally {
      setSaving(false);
    }
  }, [db, songId, userId]);

  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const setField = useCallback(
    <K extends keyof SongFields>(field: K, next: SongFields[K]) => {
      pendingRef.current = { ...pendingRef.current, [field]: next };
      setPending(pendingRef.current);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flushRef.current(), delayMs);
    },
    [delayMs],
  );

  // Leaving the screen saves what is left, rather than losing the last pause's worth.
  useEffect(
    () => () => {
      void flushRef.current();
    },
    [],
  );

  const value = useCallback(
    <K extends keyof SongFields>(field: K): SongFields[K] | undefined =>
      field in pending ? (pending[field] as SongFields[K]) : (song?.[field] as SongFields[K]),
    [pending, song],
  );

  return { value, setField, flush, saving, error, dirty: Object.keys(pending).length > 0 };
}
