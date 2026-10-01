import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = '@keres/icon-recents';
const MAX_RECENTS = 8;

/**
 * Recently picked icons, most recent first, shared by every icon picker. Durable across
 * restarts; a corrupt entry reads as empty instead of breaking the picker.
 */
export function useIconRecents(): { recents: string[]; remember: (icon: string) => void } {
  const [recents, setRecents] = useState<string[]>([]);
  const recentsRef = useRef<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed: unknown = JSON.parse(raw);
          if (!Array.isArray(parsed)) return;
          const next = parsed.filter((item): item is string => typeof item === 'string');
          recentsRef.current = next.slice(0, MAX_RECENTS);
          setRecents(recentsRef.current);
        } catch {
          // Corrupt entry reads as empty.
        }
      })
      .catch(() => {});
  }, []);
  const remember = useCallback((icon: string) => {
    const next = [icon, ...recentsRef.current.filter((item) => item !== icon)].slice(
      0,
      MAX_RECENTS,
    );
    recentsRef.current = next;
    setRecents(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  return { recents, remember };
}
