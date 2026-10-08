import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

type OpenState = Record<string, boolean>;

function parse(raw: string | null): OpenState {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
      ),
    );
  } catch {
    return {};
  }
}

/**
 * Which groups of a menu the person left open or shut, kept on the device under `storageKey` (a menu per
 * story, say) so they are as they were left the next time. A group never touched has no entry and takes the
 * menu's own default. A corrupt or unreachable store reads as nothing chosen.
 */
export function useDrawerGroupState(storageKey: string | null) {
  const [current, setCurrent] = useState<{ key: string | null; open: OpenState }>({
    key: storageKey,
    open: {},
  });

  if (current.key !== storageKey) {
    setCurrent({ key: storageKey, open: {} });
  }

  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        // What the person already changed since the menu appeared outranks what was kept.
        if (!cancelled) {
          setCurrent((now) =>
            now.key === storageKey
              ? { key: storageKey, open: { ...parse(raw), ...now.open } }
              : now,
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const setGroupOpen = useCallback(
    (groupId: string, open: boolean) => {
      const next = { ...current.open, [groupId]: open };
      setCurrent({ key: storageKey, open: next });
      if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
    },
    [current.open, storageKey],
  );

  return { open: current.key === storageKey ? current.open : {}, setGroupOpen };
}
